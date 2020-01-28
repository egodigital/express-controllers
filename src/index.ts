/**
 * This file is part of the @egodigital/express-controllers distribution.
 * Copyright (c) e.GO Digital GmbH, Aachen, Germany (https://www.e-go-digital.com/)
 *
 * @egodigital/express-controllers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * @egodigital/express-controllers is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as _ from 'lodash';
import * as express from 'express';
import * as fastGlob from 'fast-glob';
import * as joi from 'joi';
import * as path from 'path';
import { AuthorizeHandler, AuthorizeFailedHandler, createRouteAuthorizer } from './authorize';
import { InitControllersSwaggerOptionsValue, setupSwaggerUI, SwaggerInfo, SwaggerPathDefinitionUpdater, SWAGGER_INFO } from './swagger';
import { asArray, compareValuesBy, isEmptyString, isJoi, normalizeString, toBooleanSafe, toStringSafe } from './utils';


/**
 * Describes a controller.
 */
export interface Controller<TApp extends any = ExpressApp> {
    /**
     * The underlying app instance.
     */
    readonly __app: TApp;
    /**
     * The controller-wide authorization handler.
     */
    readonly __authorize?: AuthorizeHandler;
    /**
     * The controller-wide "authorization failed handler".
     */
    readonly __authorizeFailed?: AuthorizeFailedHandler;
    /**
     * Writes a debug message.
     *
     * @param {any} [message] The message to write.
     * @param {string} [tag] The optional tag.
     */
    readonly __dbg: (message?: any, tag?: string) => void;
    /**
     * An optional, custom handler for errors.
     */
    __error?: RequestErrorHandler;
    /**
     * The path to the underlying module file.
     */
    readonly __file: string;
    /**
     * Initializes the controller.
     */
    __init?: () => void;
    /**
     * The Express router.
     */
    readonly __router: express.Router;
    /**
     * The root path.
     */
    readonly __rootPath: string;
    /**
     * An optional, custom handler for serializing the response.
     */
    __serialize?: ResponseSerializer;
    /**
     * Controller wide method to update a Swagger path definition.
     */
    __updateSwaggerPath?: SwaggerPathDefinitionUpdater;
    /**
     * One or more optional request handlers, wich are used as prefixed
     * middleware(s).
     */
    __use?: express.RequestHandler | express.RequestHandler[];
}

/**
 * A function that provides the name for a controller class.
 *
 * @param {string} file The underyling class file (relative path).
 * @param {string} fullPath The underyling class file (full path).
 *
 * @return {string} The class name.
 */
export type ControllerClassNameProvider =
    (file: string, fullPath: string) => string;

/**
 * A function that provides the arguments for the constructor of a controller class.
 *
 * @param {ExpressApp} app The underlying Express app / the router.
 * @param {string} routePath The route path.
 * @param {express.Router} router The underlying Express for the controller instance.
 * @param {string} file The underlying file.
 *
 * @return {ArrayLike<any>} The list of constructors.
 */
export type ControllerClassConstructorArgsProvider =
    (
        app: ExpressApp,
        routePath: string,
        router: express.Router,
        file: string,
    ) => ArrayLike<any>;

/**
 * Arguments for a 'controller create' event handler.
 */
export interface ControllerCreatedEventArguments<TApp extends any = ExpressApp> {
    /**
     * The created instance.
     */
    controller: Controller<TApp>;
    /**
     * The file.
     */
    file: string;
}

/**
 * A handler, that is invoked, after a controller instance has been created.
 */
export type ControllerCreatedEventHandler<TApp extends any = ExpressApp> =
    (args: ControllerCreatedEventArguments<TApp>) => any;

/**
 * Arguments for a 'ControllerFileLoadedEventHandler' instance.
 */
export interface ControllerFileLoadedEventArguments {
    /**
     * The error (if occurred).
     */
    error?: any;
    /**
     * The full path of the underlying file.
     */
    file: string;
}

/**
 * Event handler, that is invoked, AFTER loading a file has been finished.
 *
 * @param {ControllerFileLoadedEventArguments} args The arguments.
 */
export type ControllerFileLoadedEventHandler =
    (args: ControllerFileLoadedEventArguments) => void;

/**
 * Arguments for a 'ControllerFileLoadingEventHandler' instance.
 */
export interface ControllerFileLoadingEventArguments {
    /**
     * The full path of the underlying file.
     */
    file: string;
}

/**
 * Event handler, that is invoked, BEFORE loading a file is going to start.
 *
 * @param {ControllerFileLoadingEventArguments} args The arguments.
 */
export type ControllerFileLoadingEventHandler =
    (args: ControllerFileLoadingEventArguments) => void;

/**
 * A preficate, which checks, if a controller (module) file
 * should be included or not.
 *
 * @param {string} file The full path of the file to check.
 *
 * @return {boolean} Handle file or not.
 */
export type ControllerFilePredicate = (file: string) => boolean;

/**
 * Options for a controller route.
 */
export interface ControllerRouteOptions {
    /**
     * A custom error handler for the route.
     */
    onError?: RequestErrorHandler;
    /**
     * A custom path.
     */
    path?: RouterPath;
    /**
     * A custom response serializer for a route.
     */
    serializer?: ResponseSerializer;
    /**
     * Additional middleware(s) for the route.
     */
    use?: express.RequestHandler | express.RequestHandler[];
}

/**
 * Options for a controller route with a body.
 */
export interface ControllerRouteWithBodyOptions extends ControllerRouteOptions {
    /**
     * If validation is enabled, this defines the input format. Default: 'JSON'
     */
    format?: BodyFormat;
    /**
     * The upload limit, in bytes.
     */
    limit?: number;
    /**
     * A custom function, that handles a failed schema validation.
     */
    onValidationFailed?: ObjectValidationFailedHandler;
    /**
     * A custom schema to check.
     */
    schema?: joi.AnySchema;
}

/**
 * A decorator function.
 *
 * @param {any} target The target.
 * @param {string} propertyName The (property) name.
 * @param {PropertyDescriptor} propertyInfo The property information.
 */
export type DecoratorFunction = (target: any, propertyName: string, propertyInfo: PropertyDescriptor) => void;

/**
 * A possible value for an express app.
 */
export type ExpressApp = express.Express | express.Router;

/**
 * Options for 'initControllers()' function.
 */
export interface InitControllersOptions<TApp extends any = ExpressApp> {
    /**
     * The underlying Express host or router.
     */
    app: ExpressApp;
    /**
     * The custom name for the controller class or a function that provides it. Default 'Controller'
     */
    controllerClass?: ControllerClassNameProvider | string;
    /**
     * The custom list of arguments for a controller class contructor or the function that provides it.
     */
    controllerConstructorArgs?: ControllerClassConstructorArgsProvider | ArrayLike<any>;
    /**
     * The custom current work directory. Default: '{PROCESS}/controllers'
     */
    cwd?: string;
    /**
     * Events.
     */
    events?: {
        /**
         * Event, that is invoked, after a controller instance has been created.
         */
        onControllerCreated?: ControllerCreatedEventHandler<TApp>;
        /**
         * Is invoked AFTER a controller file loading operation has been finished.
         */
        onFileLoaded?: ControllerFileLoadedEventHandler;
        /**
         * Is invoked BEFORE a controller file loading operation is going to be started.
         */
        onFileLoading?: ControllerFileLoadingEventHandler;
    };
    /**
     * Filter function for scanned files (s. 'files').
     */
    fileFilter?: ControllerFilePredicate;
    /**
     * One or more custom glob patterns of files to scan. Default: [ *.js ] or [ *.ts ]
     */
    files?: string | string[];
    /**
     * Swagger options.
     */
    swagger?: InitControllersSwaggerOptionsValue;
}

/**
 * A function that returns the response for a failed JSON validation.
 *
 * @param {ObjectValidationFailedHandlerContext<TRequest>} context The context.
 */
export type ObjectValidationFailedHandler<TRequest extends express.Request = express.Request> =
    (context: ObjectValidationFailedHandlerContext<TRequest>) => any;

/**
 * Context of a 'ObjectValidationFailedHandler'.
 */
export interface ObjectValidationFailedHandlerContext<TRequest extends express.Request = express.Request> {
    /**
     * The original value of the request body.
     */
    body: any;
    /**
     * An object or value, whichs contains the validation error details.
     */
    details: any;
    /**
     * An object or value, which represents an ID, that describes the reason.
     */
    reason: any;
    /**
     * The current HTTP request context.
     */
    request: TRequest;
    /**
     * The current HTTP response context.
     */
    response: express.Response;
}

/**
 * Options for an object validator.
 */
export interface ObjectValidatorOptions {
    /**
     * Indicates if input body can be (null) or not.
     */
    canBeNull?: boolean;
    /**
     * Indicates if input body can be (undefined) or not.
     */
    canBeUndefined?: boolean;
    /**
     * A custom function, that handles a failed validation.
     */
    failedHandler?: ObjectValidationFailedHandler;
    /**
     * A custom upload limit, in bytes.
     */
    limit?: number;
    /**
     * The schema.
     */
    schema?: joi.AnySchema;
}

/**
 * A value for an object validator.
 */
export type ObjectValidatorOptionsValue = ObjectValidatorOptions | joi.AnySchema;

/**
 * Handles a request error.
 *
 * @param {RequestErrorHandlerContext<TRequest>} context The context.
 */
export type RequestErrorHandler<TRequest extends express.Request = express.Request> = (context: RequestErrorHandlerContext<TRequest>) => any;

/**
 * Context for 'RequestErrorHandler'.
 */
export interface RequestErrorHandlerContext<TRequest extends express.Request = express.Request> {
    /**
     * The error.
     */
    error: any;
    /**
     * The current HTTP request context.
     */
    request: TRequest;
    /**
     * The current HTTP response context.
     */
    response: express.Response;
}

/**
 * A function, that handles the result of a request handler, serializes it
 * and sends it to the requesting client.
 *
 * @param {ResponseSerializerContext<TRequest>} context The context.
 */
export type ResponseSerializer<TRequest extends express.Request = express.Request> = (context: ResponseSerializerContext<TRequest>) => any;

/**
 * The context for a 'ResponseSerializer'.
 */
export interface ResponseSerializerContext<TRequest extends express.Request = express.Request> {
    /**
     * The request context.
     */
    request: TRequest;
    /**
     * The response context.
     */
    response: express.Response;
    /**
     * The result of the wrapped request handler.
     */
    result: any;
}

/**
 * A value for a router path.
 */
export type RouterPath = string | RegExp;


/**
 * List of body formats.‚
 */
export enum BodyFormat {
    /**
     * JSON
     */
    JSON = 0,
    /**
     * URL encoded.
     */
    UrlEncoded = 1,
}

/**
 * List of known reasons, why an object validation failed.
 */
export enum ObjectValidationFailedReason {
    /**
     * No object,
     */
    NoObject = 'no_object',
    /**
     * Invalid input.
     */
    InvalidInput = 'invalid_input',
}


const DEFAULT_CONTROLLER_CLASS_NAME = 'Controller';
const INITIALIZE_ROUTE = Symbol('INITIALIZE_ROUTE');
let objValidateFailedHandler: ObjectValidationFailedHandler;
const METHOD_LIST = Symbol('METHOD_LIST');
let reqErrorHandler: RequestErrorHandler;
const REQUEST_ERROR_HANDLER = Symbol('REQUEST_ERROR_HANDLER');
/**
 * Index / key for request validators.
 */
export const REQUEST_VALIDATORS = Symbol('REQUEST_VALIDATORS');
const RESPONSE_SERIALIZER = Symbol('RESPONSE_SERIALIZER');
let resSerializer: ResponseSerializer;


/**
 * A basic controller.
 */
export abstract class ControllerBase<TApp extends any = ExpressApp> implements Controller<TApp> {
    /**
     * Initializes a new instance of that class.
     *
     * @param {TApp} __app The underlying app instance.
     * @param {string} __rootPath The root path.
     * @param {express.Router} __router The router.
     * @param {string} __file The path of the underyling module file.
     */
    public constructor(
        public readonly __app: TApp,
        public readonly __rootPath: string,
        public readonly __router: express.Router,
        public readonly __file: string,
    ) { }

    /** @inheritdoc */
    public __dbg(message?: any, tag?: string): void {
        try {
            if (_.isNil(message)) {
                message = '';
            }

            tag = toStringSafe(tag)
                .toLowerCase()
                .trim();
            if ('' === tag) {
                tag = undefined;
            }

            console.log(message, tag);
        } catch { /* ignore */ }
    }
}


/**
 * Sets up a controller method for a CONNECT request.
 *
 * @param {ControllerRouteWithBodyOptions} [opts] The custom options.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function CONNECT(opts?: ControllerRouteWithBodyOptions): DecoratorFunction;
/**
 * Sets up a controller method for a CONNECT request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function CONNECT(path: RouterPath, schema?: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a CONNECT request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function CONNECT(path: RouterPath, schema?: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a CONNECT request by validating a request body.
 *
 * @param {joi.AnySchema} schema The schema to use.
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function CONNECT(schema: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a CONNECT request
 * using a custom path and by optional validating a request body.
 *
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function CONNECT(schema: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
export function CONNECT(...args: any[]): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        createRouteInitializerForMethod(
            name, descriptor, toControllerRouteWithBodyOptions(args),
            'connect',
        );
    };
}

/**
 * Sets up a controller method for a DELETE request.
 *
 * @param {ControllerRouteWithBodyOptions} [opts] The custom options.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function DELETE(opts?: ControllerRouteWithBodyOptions): DecoratorFunction;
/**
 * Sets up a controller method for a DELETE request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function DELETE(path: RouterPath, schema?: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a DELETE request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function DELETE(path: RouterPath, schema?: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a DELETE request by validating a request body.
 *
 * @param {joi.AnySchema} schema The schema to use.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function DELETE(schema: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a DELETE request
 * using a custom path and by optional validating a request body.
 *
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function DELETE(schema: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
export function DELETE(...args: any[]): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        createRouteInitializerForMethod(
            name, descriptor, toControllerRouteWithBodyOptions(args),
            'delete',
        );
    };
}

/**
 * Sets up a controller method for a GET request.
 *
 * @param {ControllerRouteOptions} [opts] The custom options.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function GET(opts?: ControllerRouteOptions): DecoratorFunction;
/**
 * Sets up a controller method for a GET request
 * using a custom path.
 *
 * @param {RouterPath} path The custom path to use.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function GET(path: RouterPath): DecoratorFunction;
export function GET(...args: any[]): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        createRouteInitializerForMethod(
            name, descriptor, toControllerRouteOptions(args),
            'get',
        );
    };
}

/**
 * Sets up a controller method for a HEAD request.
 *
 * @param {ControllerRouteOptions} [opts] The custom options.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function HEAD(opts?: ControllerRouteOptions): DecoratorFunction;
/**
 * Sets up a controller method for a HEAD request
 * using a custom path.
 *
 * @param {RouterPath} path The custom path to use.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function HEAD(path: RouterPath): DecoratorFunction;
export function HEAD(...args: any[]): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        createRouteInitializerForMethod(
            name, descriptor, toControllerRouteOptions(args),
            'head',
        );
    };
}

/**
 * Sets up a controller method for a OPTIONS request.
 *
 * @param {ControllerRouteOptions} [opts] The custom options.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function OPTIONS(opts?: ControllerRouteOptions): DecoratorFunction;
/**
 * Sets up a controller method for a OPTIONS request
 * using a custom path.
 *
 * @param {RouterPath} path The custom path to use.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function OPTIONS(path: RouterPath): DecoratorFunction;
export function OPTIONS(...args: any[]): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        createRouteInitializerForMethod(
            name, descriptor, toControllerRouteOptions(args),
            'options',
        );
    };
}

/**
 * Sets up a controller method for a PATCH request.
 *
 * @param {ControllerRouteWithBodyOptions} [opts] The custom options.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function PATCH(opts?: ControllerRouteWithBodyOptions): DecoratorFunction;
/**
 * Sets up a controller method for a PATCH request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function PATCH(path: RouterPath, schema?: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a PATCH request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function PATCH(path: RouterPath, schema?: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a PATCH request by validating a request body.
 *
 * @param {joi.AnySchema} schema The schema to use.
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function PATCH(schema: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a PATCH request
 * using a custom path and by optional validating a request body.
 *
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function PATCH(schema: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
export function PATCH(...args: any[]): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        createRouteInitializerForMethod(
            name, descriptor, toControllerRouteWithBodyOptions(args),
            'patch',
        );
    };
}

/**
 * Sets up a controller method for a POST request.
 *
 * @param {ControllerRouteWithBodyOptions} [opts] The custom options.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function POST(opts?: ControllerRouteWithBodyOptions): DecoratorFunction;
/**
 * Sets up a controller method for a POST request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function POST(path: RouterPath, schema?: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a POST request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function POST(path: RouterPath, schema?: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a POST request by validating a request body.
 *
 * @param {joi.AnySchema} schema The schema to use.
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function POST(schema: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a POST request
 * using a custom path and by optional validating a request body.
 *
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function POST(schema: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
export function POST(...args: any[]): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        createRouteInitializerForMethod(
            name, descriptor, toControllerRouteWithBodyOptions(args),
            'post',
        );
    };
}

/**
 * Sets up a controller method for a PUT request.
 *
 * @param {ControllerRouteWithBodyOptions} [opts] The custom options.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function PUT(opts?: ControllerRouteWithBodyOptions): DecoratorFunction;
/**
 * Sets up a controller method for a PUT request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function PUT(path: RouterPath, schema?: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a PUT request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function PUT(path: RouterPath, schema?: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a PUT request by validating a request body.
 *
 * @param {joi.AnySchema} schema The schema to use.
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function PUT(schema: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a PUT request
 * using a custom path and by optional validating a request body.
 *
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function PUT(schema: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
export function PUT(...args: any[]): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        createRouteInitializerForMethod(
            name, descriptor, toControllerRouteWithBodyOptions(args),
            'put',
        );
    };
}

/**
 * Sets up a controller method for a TRACE request.
 *
 * @param {ControllerRouteWithBodyOptions} [opts] The custom options.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function TRACE(opts?: ControllerRouteWithBodyOptions): DecoratorFunction;
/**
 * Sets up a controller method for a TRACE request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function TRACE(path: RouterPath, schema?: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a TRACE request
 * using a custom path and by optional validating a request body.
 *
 * @param {RouterPath} path The custom path to use.
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function TRACE(path: RouterPath, schema?: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a TRACE request by validating a request body.
 *
 * @param {joi.AnySchema} schema The schema to use.
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function TRACE(schema: joi.AnySchema, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for a TRACE request
 * using a custom path and by optional validating a request body.
 *
 * @param {joi.AnySchema} [schema] The optional schema to use.
 * @param {BodyFormat} [format] The custom input format. Default: 'JSON'
 * @param {ObjectValidationFailedHandler} [onValidationFailed] The optional, custom handler, that is invoked if a (schema) validation failed.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function TRACE(schema: joi.AnySchema, format?: BodyFormat, onValidationFailed?: ObjectValidationFailedHandler): DecoratorFunction;
export function TRACE(...args: any[]): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        createRouteInitializerForMethod(
            name, descriptor, toControllerRouteWithBodyOptions(args),
            'trace',
        );
    };
}


/**
 * Returns the global handler, if an object validation fails.
 *
 * @return {ObjectValidationFailedHandler} The handler.
 */
export function getObjectValidationFailedHandler(): ObjectValidationFailedHandler {
    let handler: ObjectValidationFailedHandler = objValidateFailedHandler;
    if (_.isNil(handler)) {
        // default

        handler = (ctx) => {
            const RESULT = {
                success: false,
                data: {
                    details: ctx.details,
                    reason: ctx.reason,
                },
            };

            return ctx.response
                .status(400)
                .header('content-type', 'application/json; charset=utf-8')
                .send(Buffer.from(JSON.stringify(RESULT), 'utf8'));
        };
    }

    return handler;
}

/**
 * Returns the global error handler, if a request fails.
 *
 * @return {RequestErrorHandler} The handler.
 */
export function getRequestErrorHandler(): RequestErrorHandler {
    let handler: RequestErrorHandler = reqErrorHandler;
    if (_.isNil(handler)) {
        // default

        handler = (ctx) => {
            return ctx.response
                .status(500)
                .send();
        };
    }

    return handler;
}

/**
 * Returns the global response serializer.
 *
 * @return {ResponseSerializer|null|undefined} The serializer, if defined.
 */
export function getResponseSerializer(): ResponseSerializer | null | undefined {
    return resSerializer;
}

/**
 * Initializes contollers.
 *
 * @param {InitControllersOptions} opts The options.
 */
export function initControllers(opts: InitControllersOptions): void {
    const MODULE_EXT = path.extname(__filename);

    let cwd = toStringSafe(opts.cwd);
    if (isEmptyString(cwd)) {
        cwd = path.join(
            process.cwd(), 'controllers'
        );
    }
    if (!path.isAbsolute(cwd)) {
        cwd = path.join(
            process.cwd(), cwd
        );
    }
    cwd = path.resolve(cwd);

    let onControllerCreated: ControllerCreatedEventHandler;
    let onFileLoaded: ControllerFileLoadedEventHandler;
    let onFileLoading: ControllerFileLoadingEventHandler;
    if (!_.isNil(opts.events)) {
        onControllerCreated = opts.events.onControllerCreated;
        onFileLoaded = opts.events.onFileLoaded;
        onFileLoading = opts.events.onFileLoading;
    }

    // controller class name
    let controllerClassNameProvider: ControllerClassNameProvider;
    if (!_.isNil(opts.controllerClass)) {
        if (_.isFunction(opts.controllerClass)) {
            controllerClassNameProvider = opts.controllerClass as ControllerClassNameProvider;
        } else {
            controllerClassNameProvider = () => opts.controllerClass as string;
        }
    }
    if (_.isNil(controllerClassNameProvider)) {
        // default
        controllerClassNameProvider = () => DEFAULT_CONTROLLER_CLASS_NAME;
    }

    // constructor arguments for controller class
    let controllerConstructorArgsProvider: ControllerClassConstructorArgsProvider;
    if (!_.isNil(opts.controllerConstructorArgs)) {
        if (_.isFunction(opts.controllerConstructorArgs)) {
            controllerConstructorArgsProvider = opts.controllerConstructorArgs as ControllerClassConstructorArgsProvider;
        } else {
            controllerConstructorArgsProvider = () => opts.controllerConstructorArgs as ArrayLike<any>;
        }
    }
    if (_.isNil(controllerConstructorArgsProvider)) {
        // default
        controllerConstructorArgsProvider = function () {
            return arguments;
        };
    }

    let fileFilter = opts.fileFilter;
    if (_.isNil(fileFilter)) {
        fileFilter = () => true;  // default: accept all
    }

    const FILE_PATTERNS = asArray(opts.files)
        .map(fp => toStringSafe(fp))
        .filter(fp => '' !== fp.trim());
    if (!FILE_PATTERNS.length) {
        FILE_PATTERNS.push(
            '**/*' + MODULE_EXT
        );
    }

    const FILES = fastGlob.sync(
        FILE_PATTERNS,
        {
            absolute: true,
            cwd: cwd,
            dot: false,
            followSymbolicLinks: true,
            onlyDirectories: false,
            onlyFiles: true,
            stats: false,
            throwErrorOnBrokenSymbolicLink: true,
            unique: true,
        }
    ).filter(f => {
        return !path.basename(f)
            .startsWith('_');  // files with leading underscores are ignored
    }).sort((x, y) => {
        // first sort by directory name
        const COMP_0 = compareValuesBy(x, y, f => {
            return normalizeString(
                path.dirname(f)
            );
        });
        if (0 !== COMP_0) {
            return COMP_0;
        }

        const COMP_1 = compareValuesBy(x, y, (f) => {
            switch (path.basename(f, path.extname(f))) {
                case 'index':
                    return Number.MIN_SAFE_INTEGER;  // 'index' file is always first
            }

            return Number.MAX_SAFE_INTEGER;
        });
        if (0 !== COMP_1) {
            return COMP_1;
        }

        // then by file name
        return compareValuesBy(x, y, f => {
            return normalizeString(
                path.basename(f)
            );
        });
    });

    const ROUTERS: { [path: string]: express.Router } = {};

    const SWAGGER_INFOS: SwaggerInfo[] = [];

    for (const F of FILES) {
        if (!fileFilter(F)) {
            continue;
        }

        let loadingError: any;
        try {
            if (onFileLoading) {
                onFileLoading({
                    file: F,
                });
            }

            const CONTROLLER_MODULE_FILE = path.basename(F, path.extname(F));

            const CONTROLLER_MODULE = require(
                path.join(
                    path.dirname(F),
                    CONTROLLER_MODULE_FILE,
                )
            );

            const FILE_ROOT_PATH = normalizeRoutePath(
                path.relative(
                    cwd,
                    path.dirname(F) + '/' + ('index' === CONTROLLER_MODULE_FILE ? '' : CONTROLLER_MODULE_FILE),
                )
            );

            // custom class name
            let controllerClassName = controllerClassNameProvider(
                FILE_ROOT_PATH, F,
            );

            const CONTROLLER_CLASS = CONTROLLER_MODULE[controllerClassName];
            if (CONTROLLER_CLASS) {
                const ROOT_PATH = FILE_ROOT_PATH.split('/@')
                    .join('/:');

                if (_.isNil(ROUTERS[ROOT_PATH])) {
                    ROUTERS[ROOT_PATH] = express.Router({
                        mergeParams: true,
                    });

                    opts.app
                        .use(ROOT_PATH, ROUTERS[ROOT_PATH]);
                }

                const ROUTER = ROUTERS[ROOT_PATH];

                // constructor arguments
                let controllerConstructorArgs = controllerConstructorArgsProvider(
                    opts.app,
                    ROOT_PATH,
                    ROUTER,
                    F,
                );
                if (_.isNil(controllerConstructorArgs)) {
                    controllerConstructorArgs = [];  // default
                }
                if (!_.isArray(controllerConstructorArgs)) {
                    // convert to array
                    const ARR = controllerConstructorArgs;

                    controllerConstructorArgs = [];
                    for (let i = 0; i < ARR.length; i++) {
                        (controllerConstructorArgs as Array<any>).push(
                            ARR[i]
                        );
                    }
                }

                // s. https://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible
                const CONTROLLER: Controller = new (Function.prototype.bind.apply(
                    CONTROLLER_CLASS, [CONTROLLER_CLASS].concat(
                        controllerConstructorArgs
                    ))
                );

                if (onControllerCreated) {
                    onControllerCreated(
                        {
                            controller: CONTROLLER,
                            file: F,
                        }
                    );
                }

                const ROUTER_MIDDLEWARES = asArray(CONTROLLER.__use)
                    .map(rmw => wrapHandlerForController(CONTROLLER, rmw, false));
                if (ROUTER_MIDDLEWARES.length) {
                    ROUTER.use
                        .apply(ROUTER, ROUTER_MIDDLEWARES);
                }

                if (!_.isNil(CONTROLLER.__init)) {
                    CONTROLLER.__init();
                }

                // get all methods, which have an
                // 'INITIALIZE_ROUTE' function
                const METHOD_NAMES = Object.getOwnPropertyNames(
                    CONTROLLER_CLASS.prototype
                ).filter(mn => {
                    return _.isFunction(
                        CONTROLLER[mn][INITIALIZE_ROUTE]
                    );
                }).sort((x, y) => {
                    const COMP_0 = compareValuesBy(x, y, (mn) => {
                        switch (mn) {
                            case 'index':
                                return Number.MIN_SAFE_INTEGER;  // 'index' method is always first
                        }

                        return Number.MAX_SAFE_INTEGER;
                    });
                    if (0 !== COMP_0) {
                        return COMP_0;
                    }

                    return compareValuesBy(x, y, i => {
                        return normalizeString(i);
                    });
                });

                // execute 'INITIALIZE_ROUTE' functions
                // and setup swagger
                for (const MN of METHOD_NAMES) {
                    const SWAGGER: SwaggerInfo = CONTROLLER[MN][SWAGGER_INFO];

                    if (!_.isNil(SWAGGER)) {
                        SWAGGER.controller = CONTROLLER;
                        SWAGGER.controllerMethod = CONTROLLER[MN];
                        SWAGGER.methods = asArray<string>(CONTROLLER[MN][METHOD_LIST]);
                        SWAGGER.controllerRootPath = ROOT_PATH;

                        SWAGGER_INFOS.push(SWAGGER);
                    }

                    CONTROLLER[MN][INITIALIZE_ROUTE](
                        CONTROLLER
                    );
                }
            }
        } catch (e) {
            loadingError = e;

            throw e;
        } finally {
            if (onFileLoaded) {
                onFileLoaded({
                    error: loadingError,
                    file: F,
                });
            }
        }
    }

    setupSwaggerUI(opts.app, opts.swagger, SWAGGER_INFOS);
}

/**
 * Sets the global handler, which checks if an object validation fails.
 *
 * @param {ObjectValidationFailedHandler|undefined|null} newHandler The new handler.
 */
export function setObjectValidationFailedHandler(
    newHandler: ObjectValidationFailedHandler | undefined | null
): void {
    objValidateFailedHandler = newHandler;
}

/**
 * Sets the global handler, which handles request errors.
 *
 * @param {RequestErrorHandler|undefined|null} newHandler The new handler.
 */
export function setRequestErrorHandler(
    newHandler: RequestErrorHandler | undefined | null
): void {
    reqErrorHandler = newHandler;
}

/**
 * Sets a global response serializer.
 *
 * @param {ResponseSerializer|undefined|null} newSerializer The new serializer.
 */
export function setResponseSerializer(
    newSerializer: ResponseSerializer | undefined | null
) {
    resSerializer = newSerializer;
}


function createRouteInitializer(
    name: string, descriptor: PropertyDescriptor,
    opts: ControllerRouteOptions | ControllerRouteWithBodyOptions,
    ifFunction: (controller: Controller, path: RouterPath, handler: express.RequestHandler) => void,
    ifArray: (controller: Controller, path: RouterPath, handlers: express.RequestHandler[]) => void,
    prepare?: (opts: ControllerRouteOptions | ControllerRouteWithBodyOptions, path: RouterPath) => void,
): void {
    if (_.isNil(opts)) {
        opts = {} as any;
    }

    if (isJoi(opts)) {
        opts = {
            schema: opts,
        };
    }

    if (!_.isObjectLike(opts) || _.isRegExp(opts)) {
        opts = {
            path: opts as RouterPath,
        };
    }

    const VALUE = descriptor.value;

    if (name.startsWith('_')) {
        return;
    }

    descriptor.enumerable = true;

    let routerPath: RouterPath;
    if (_.isNil((opts as ControllerRouteOptions).path)) {
        // default

        routerPath = '/';
        if ('index' !== name) {
            routerPath += name;
        }
    } else {
        routerPath = (opts as ControllerRouteOptions).path;
        if (!_.isRegExp(routerPath)) {
            // string path

            routerPath = toStringSafe(routerPath)
                .trim();
        }
    }

    if (_.isString(routerPath)) {
        // normalize
        routerPath = normalizeRoutePath(routerPath);
    }

    if (!_.isNil(prepare)) {
        prepare(
            opts as ControllerRouteOptions,
            routerPath
        );
    }

    switch (name) {
        default:
            {
                const BASE_FUNC: Function = VALUE[INITIALIZE_ROUTE];

                VALUE[REQUEST_ERROR_HANDLER] = opts.onError;
                VALUE[RESPONSE_SERIALIZER] = opts.serializer;
                VALUE[INITIALIZE_ROUTE] = function (controller: Controller) {
                    if (!_.isNil(BASE_FUNC)) {
                        BASE_FUNC.apply(null, arguments);
                    }

                    if (_.isFunction(VALUE)) {
                        ifFunction(
                            controller,
                            routerPath,
                            VALUE as express.RequestHandler,
                        );
                    } else {
                        ifArray(
                            controller,
                            routerPath,
                            asArray<express.RequestHandler>(VALUE),
                        );
                    }
                };
            }
            break;
    }
}

function createRouteInitializerForMethod(
    name: string, descriptor: PropertyDescriptor,
    opts: ControllerRouteOptions | ControllerRouteWithBodyOptions,
    method: string,
): void {
    let inputFormat: number;
    let routeMiddlewares: express.RequestHandler | express.RequestHandler[];
    if (!_.isNil(opts)) {
        inputFormat = parseInt(
            toStringSafe((opts as ControllerRouteWithBodyOptions).format)
                .trim()
        );

        routeMiddlewares = opts.use;
    }

    if (isNaN(inputFormat)) {
        inputFormat = BodyFormat.JSON;
    }

    const VALUE: Function = descriptor.value;

    // method list (for Swagger UI, e.g.)
    {
        if (!_.isArray(VALUE[METHOD_LIST])) {
            VALUE[METHOD_LIST] = [];
        }

        if (VALUE[METHOD_LIST].indexOf(method) < 0) {
            VALUE[METHOD_LIST].push(method);
        }
    }

    const UPDATE_SWAGGER_INFO = (p: RouterPath) => {
        const SI: SwaggerInfo = VALUE[SWAGGER_INFO];
        if (!_.isNil(SI)) {
            p = normalizeRoutePath(
                path.join(
                    SI.controllerRootPath, toStringSafe(p)
                )
            );

            if (_.isNil(SI.groupedRouterMethods[p])) {
                SI.groupedRouterMethods[p] = [];
            }

            if (SI.groupedRouterMethods[p].indexOf(method) < 0) {
                SI.groupedRouterMethods[p].push(
                    method
                );
            }
        }
    };

    createRouteInitializer(
        name, descriptor, opts,
        (controller, path, handler) => {
            UPDATE_SWAGGER_INFO(path);

            controller.__router[method]
                .apply(controller.__router,
                    [path as any]
                        .concat(
                            asArray(routeMiddlewares)
                                .map(rmw => wrapHandlerForController(controller, rmw, false))
                        )
                        .concat(
                            [
                                createRouteAuthorizer(controller, VALUE),
                            ].map(a => wrapHandlerForController(controller, a, false))
                        )
                        .concat(
                            asArray(descriptor.value[REQUEST_VALIDATORS])
                                .map(rv => wrapHandlerForController(controller, rv, false))
                        )
                        .concat([
                            wrapHandlerForController(controller, handler, true)]
                        )
                );
        },
        (controller, path, handlers) => {
            UPDATE_SWAGGER_INFO(path);

            controller.__router[method]
                .apply(controller.__router,
                    [path as any]
                        .concat(
                            asArray(routeMiddlewares)
                                .map(rmw => wrapHandlerForController(controller, rmw, false))
                        )
                        .concat(
                            [
                                createRouteAuthorizer(controller, VALUE),
                            ].map(a => wrapHandlerForController(controller, a, false))
                        )
                        .concat(
                            asArray(descriptor.value[REQUEST_VALIDATORS])
                                .map(rv => wrapHandlerForController(controller, rv, false))
                        )
                        .concat(
                            handlers.map(h => wrapHandlerForController(controller, h, true))
                        )
                );
        },
        (opts) => {
            const SCHEMA: joi.AnySchema = (opts as ControllerRouteWithBodyOptions).schema;
            if (isJoi(SCHEMA)) {
                let inputHandlers: express.RequestHandler[];
                switch (inputFormat) {
                    case BodyFormat.JSON:
                        // JSON
                        inputHandlers = jsonValidate(
                            {
                                failedHandler: (opts as ControllerRouteWithBodyOptions).onValidationFailed,
                                limit: (opts as ControllerRouteWithBodyOptions).limit,
                                schema: SCHEMA,
                            },
                            req => method !== normalizeString(req.method),
                        );
                        break;

                    case BodyFormat.UrlEncoded:
                        // form / url encoded
                        inputHandlers = formValidate(
                            {
                                failedHandler: (opts as ControllerRouteWithBodyOptions).onValidationFailed,
                                limit: (opts as ControllerRouteWithBodyOptions).limit,
                                schema: SCHEMA,
                            },
                            req => method !== normalizeString(req.method),
                        );
                        break;

                    default:
                        throw new Error(`BodyFormat '${inputFormat}' is not supported!`);
                }

                // append to current list
                descriptor.value[REQUEST_VALIDATORS] = asArray(
                    descriptor.value[REQUEST_VALIDATORS]
                ).concat(
                    asArray(inputHandlers)
                );
            }
        }
    );
}

function formValidate(
    optsOrSchema: ObjectValidatorOptionsValue,
    skipIf?: (req: express.Request) => boolean,
): express.RequestHandler[] {
    const OPTS = toObjectValidatorOptions(optsOrSchema);
    const LIMIT = getObjectValidationUploadLimit(OPTS);

    return objectValidate(
        express.urlencoded({
            extended: true,
            limit: LIMIT,
        }),
        OPTS,
        skipIf,
    );
}

function getObjectValidationUploadLimit(opts: ObjectValidatorOptions): number {
    let limit = parseInt(
        toStringSafe(opts.limit)
            .trim()
    );
    if (isNaN(limit)) {
        limit = undefined;
    }

    return limit;
}

function jsonValidate(
    optsOrSchema: ObjectValidatorOptionsValue,
    skipIf?: (req: express.Request) => boolean,
): express.RequestHandler[] {
    const OPTS = toObjectValidatorOptions(optsOrSchema);
    const LIMIT = getObjectValidationUploadLimit(OPTS);

    return objectValidate(
        express.json({
            limit: LIMIT,
        }),
        OPTS,
        skipIf,
    );
}

function objectValidate(
    middlewares: express.RequestHandler | express.RequestHandler[],
    opts: ObjectValidatorOptions,
    skipIf?: (req: express.Request) => boolean,
): express.RequestHandler[] {
    if (_.isNil(skipIf)) {
        skipIf = () => false;
    }

    return asArray(middlewares).concat([
        async (req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (skipIf(req)) {
                return next();
            }

            let failedHandler = opts.failedHandler;
            if (_.isNil(failedHandler)) {
                // default
                failedHandler = getObjectValidationFailedHandler();
            }

            let reason: any = ObjectValidationFailedReason.NoObject;
            let details: any;

            const BODY = req.body;

            if (_.isNull(BODY) && toBooleanSafe(opts.canBeNull)) {
                return next();  // can be (null)
            }
            if (_.isUndefined(BODY) && toBooleanSafe(opts.canBeUndefined)) {
                return next();  // can be (undefined)
            }

            if (_.isObjectLike(BODY)) {
                if (_.isNil(opts.schema)) {
                    // no schema check
                    return next();
                } else {
                    reason = ObjectValidationFailedReason.InvalidInput;

                    const JSON_VALIDATION = opts.schema.validate(BODY);
                    if (_.isNil(JSON_VALIDATION.error)) {
                        return next();
                    } else {
                        // check failed
                        details = JSON_VALIDATION.error.message;
                    }
                }
            }

            return Promise.resolve(
                failedHandler({
                    body: BODY,
                    details: details,
                    reason: reason,
                    request: req,
                    response: res,
                })
            );
        },
    ]);
}

function normalizeRoutePath(p: string): string {
    p = toStringSafe(p)
        .trim();

    p = p.split(path.sep)
        .join('/');

    while (p.endsWith('/')) {
        p = p.substr(0, p.length - 1)
            .trim();
    }

    if (!p.startsWith('/')) {
        p = '/' + p;
    }

    return p;
}

function toControllerRouteOptions(args: any[]): ControllerRouteOptions {
    let opts: ControllerRouteOptions;

    if (args.length) {
        const FIRST_ARG = args[0];

        if (_.isObjectLike(FIRST_ARG)) {
            // opts?: ControllerRouteOptions

            opts = FIRST_ARG as ControllerRouteOptions;
        } else {
            // path: RouterPath

            opts = {
                path: FIRST_ARG,
            };
        }
    }

    return opts;
}

function toControllerRouteWithBodyOptions(args: any[]): ControllerRouteWithBodyOptions {
    let opts: ControllerRouteWithBodyOptions;
    if (args.length) {
        const FIRST_ARG = args[0];

        const UPDATE_OPTS_BY_SCHEMA_ARGS = (arg0: any, arg1: any) => {
            if (_.isFunction(arg0)) {
                opts.onValidationFailed = arg0 as ObjectValidationFailedHandler;
            } else {
                opts.format = arg0 as BodyFormat;
                opts.onValidationFailed = arg1 as ObjectValidationFailedHandler;
            }
        };

        if (isJoi(FIRST_ARG)) {
            // [0] schema: joi.AnySchema

            // [1] onValidationFailed?: ObjectValidationFailedHandler
            // --- or ---
            // [1] format?: BodyFormat
            // [2] onValidationFailed?: ObjectValidationFailedHandler

            opts = {
                schema: FIRST_ARG as joi.AnySchema,
            };

            UPDATE_OPTS_BY_SCHEMA_ARGS(args[1], args[2]);
        } else if (_.isObjectLike(FIRST_ARG)) {
            // opts?: ControllerRouteWithBodyOptions

            opts = FIRST_ARG as ControllerRouteWithBodyOptions;
        } else {
            // [0] path: RouterPath
            // [1] schema?: joi.AnySchema

            // [2] onValidationFailed?: ObjectValidationFailedHandler
            // --- or ---
            // [2] format?: BodyFormat
            // [3] onValidationFailed?: ObjectValidationFailedHandler

            opts = {
                path: FIRST_ARG as RouterPath,
                schema: args[1] as joi.AnySchema,
            };

            UPDATE_OPTS_BY_SCHEMA_ARGS(args[2], args[3]);
        }
    }

    return opts;
}

function toObjectValidatorOptions(optsOrSchema: ObjectValidatorOptionsValue): ObjectValidatorOptions {
    let opts: ObjectValidatorOptions;
    if (_.isNil(optsOrSchema)) {
        opts = {} as any;
    } else {
        if (isJoi(optsOrSchema)) {
            opts = {
                schema: optsOrSchema,
            };
        } else {
            opts = optsOrSchema as ObjectValidatorOptions;
        }
    }

    return opts;
}

function wrapHandlerForController(
    controller: Controller, handler: express.RequestHandler,
    useSerializer: boolean
): express.RequestHandler {
    return async function (req: express.Request, res: express.Response) {
        try {
            const HANDLER_RESULT = await Promise.resolve(
                handler.apply(controller, arguments)
            );

            let result: any;

            if (useSerializer) {
                let serializer: ResponseSerializer = handler[RESPONSE_SERIALIZER];  // custom serializer by request
                if (_.isNil(serializer)) {
                    serializer = controller.__serialize;  // default of controller
                }
                if (_.isNil(serializer)) {
                    serializer = getResponseSerializer();  // global default
                }

                if (_.isNil(serializer)) {
                    // no serializer
                    result = HANDLER_RESULT;
                } else {
                    const CTX: ResponseSerializerContext = {
                        request: req,
                        response: res,
                        result: HANDLER_RESULT,
                    };

                    result = await Promise.resolve(
                        serializer.apply(controller, [
                            CTX
                        ])
                    );
                }
            } else {
                result = HANDLER_RESULT;
            }

            return result;
        } catch (e) {
            let errorHandler: RequestErrorHandler = handler[REQUEST_ERROR_HANDLER];  // custom handler by request
            if (_.isNil(errorHandler)) {
                errorHandler = controller.__error;  // default of controller
            }
            if (_.isNil(errorHandler)) {
                errorHandler = getRequestErrorHandler();  // (global) default
            }

            const CTX: RequestErrorHandlerContext = {
                error: e,
                request: req,
                response: res,
            };

            return Promise.resolve(
                errorHandler.apply(controller, [
                    CTX
                ])
            );
        }
    };
}


export * from './authorize';
export * from './swagger';
export * from './tools';
