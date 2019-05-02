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
import { asArray, compareValuesBy, isEmptyString, isJoi, normalizeString, toBooleanSafe, toStringSafe } from './utils';


/**
 * Describes a controller.
 */
export interface Controller {
    /**
     * The underlying Express host or router.
     */
    readonly __app: ExpressApp;
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
     * One or more optional request handlers, wich are used as prefixed
     * middleware(s).
     */
    __use?: express.RequestHandler | express.RequestHandler[];
}

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
export interface InitControllersOptions {
    /**
     * The underlying Express host or router.
     */
    app: ExpressApp;
    /**
     * The custom current work directory. Default: '{PROCESS}/controllers'
     */
    cwd?: string;
    /**
     * One or more custom glob patterns of files to scan. Default: [ *.js, *.ts ]
     */
    files?: string | string[];
}

/**
 * A function that returns the response for a failed JSON validation.
 *
 * @param {ObjectValidationFailedHandlerContext} context The context.
 */
export type ObjectValidationFailedHandler =
    (context: ObjectValidationFailedHandlerContext) => any;

/**
 * Context of a 'ObjectValidationFailedHandler'.
 */
export interface ObjectValidationFailedHandlerContext {
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
    request: express.Request;
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
 * @param {RequestErrorHandlerContext} context The context.
 */
export type RequestErrorHandler = (context: RequestErrorHandlerContext) => any;

/**
 * Context for 'RequestErrorHandler'.
 */
export interface RequestErrorHandlerContext {
    /**
     * The error.
     */
    error: any;
    /**
     * The current HTTP request context.
     */
    request: express.Request;
    /**
     * The current HTTP response context.
     */
    response: express.Response;
}

/**
 * A function, that handles the result of a request handler, serializes it
 * and sends it to the requesting client.
 *
 * @param {ResponseSerializerContext} context The context.
 */
export type ResponseSerializer = (context: ResponseSerializerContext) => any;

/**
 * The context for a 'ResponseSerializer'.
 */
export interface ResponseSerializerContext {
    /**
     * The request context.
     */
    request: express.Request;
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


const INITIALIZE_ROUTE = Symbol('INITIALIZE_ROUTE');
let objValidateFailedHandler: ObjectValidationFailedHandler;
let reqErrorHandler: RequestErrorHandler;
const REQUEST_ERROR_HANDLER = Symbol('REQUEST_ERROR_HANDLER');
const REQUEST_VALIDATORS = Symbol('REQUEST_VALIDATORS');


/**
 * A basic controller.
 */
export abstract class ControllerBase implements Controller {
    /**
     * Initializes a new instance of that class.
     *
     * @param {ExpressApp} __app The underlying Express host or router.
     * @param {string} __rootPath The root path.
     * @param {express.Router} __router The router.
     * @param {string} __file The path of the underyling module file.
     */
    public constructor(
        public readonly __app: ExpressApp,
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
            return ctx.response.status(500)
                .send();
        };
    }

    return handler;
}

/**
 * Initializes contollers.
 *
 * @param {InitControllersOptions} opts The options.
 */
export function initControllers(opts: InitControllersOptions): void {
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

    const FILE_PATTERNS = asArray(opts.files)
        .map(fp => toStringSafe(fp))
        .filter(fp => '' !== fp.trim());
    if (!FILE_PATTERNS.length) {
        FILE_PATTERNS.push(
            '**/*.ts', '**/*.js'
        );
    }

    const FILES = (fastGlob.sync(
        FILE_PATTERNS,
        {
            absolute: true,
            cwd: cwd,
            deep: true,
            dot: false,
            followSymlinkedDirectories: true,
            onlyDirectories: false,
            onlyFiles: true,
            stats: false,
            unique: true,
        }
    ) as string[]).filter(f => {
        return !path.basename(f)
            .startsWith('_');  // files with leading undrscores are ignored
    }).sort((x, y) => {
        const COMP_0 = compareValuesBy(x, y, f => {
            return normalizeString(
                path.dirname(f)
            );
        });
        if (0 !== COMP_0) {
            return COMP_0;
        }

        compareValuesBy(x, y, f => {
            return normalizeString(
                path.basename(f)
            );
        });
    });

    const ROUTERS: { [path: string]: express.Router } = {};

    for (const F of FILES) {
        const CONTROLLER_MODULE_FILE = path.basename(F, path.extname(F));

        const CONTROLLER_MODULE = require(
            path.join(
                path.dirname(F),
                CONTROLLER_MODULE_FILE,
            )
        );

        const CONTROLLER_CLASS = CONTROLLER_MODULE.Controller;
        if (CONTROLLER_CLASS) {
            const ROOT_PATH = normalizeRoutePath(
                path.relative(
                    cwd,
                    path.dirname(F) + '/' + ('index' === CONTROLLER_MODULE_FILE ? '' : CONTROLLER_MODULE_FILE),
                )
            );

            if (_.isNil(ROUTERS[ROOT_PATH])) {
                ROUTERS[ROOT_PATH] = express.Router();

                opts.app
                    .use(ROOT_PATH, ROUTERS[ROOT_PATH]);
            }

            const ROUTER = ROUTERS[ROOT_PATH];

            const CONTROLLER: Controller = new CONTROLLER_CLASS(
                opts.app,
                ROOT_PATH,
                ROUTER,
                F,
            );

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
                            return 0;  // index is always first
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
            for (const MN of METHOD_NAMES) {
                CONTROLLER[MN][INITIALIZE_ROUTE](
                    CONTROLLER
                );
            }
        }
    }
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

    createRouteInitializer(
        name, descriptor, opts,
        (controller, path, handler) => {
            controller.__router[method]
                .apply(controller.__router,
                    [path as any]
                        .concat(
                            asArray(routeMiddlewares)
                                .map(rmw => wrapHandlerForController(controller, rmw, false))
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
            controller.__router[method]
                .apply(controller.__router,
                    [path as any]
                        .concat(
                            asArray(routeMiddlewares)
                                .map(rmw => wrapHandlerForController(controller, rmw, false))
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
    return objectValidate(
        express.urlencoded({ extended: true, }),
        optsOrSchema,
        skipIf,
    );
}

function jsonValidate(
    optsOrSchema: ObjectValidatorOptionsValue,
    skipIf?: (req: express.Request) => boolean,
): express.RequestHandler[] {
    return objectValidate(
        express.json(),
        optsOrSchema,
        skipIf,
    );
}

function objectValidate(
    middlewares: express.RequestHandler,
    optsOrSchema: ObjectValidatorOptionsValue,
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

            return await Promise.resolve(
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
                const SERIALIZER = controller.__serialize;
                if (_.isNil(SERIALIZER)) {
                    // no serializer
                    result = HANDLER_RESULT;
                } else {
                    const CTX: ResponseSerializerContext = {
                        request: req,
                        response: res,
                        result: HANDLER_RESULT,
                    };

                    result = await Promise.resolve(
                        SERIALIZER.apply(controller, [
                            CTX
                        ])
                    );
                }
            } else {
                result = HANDLER_RESULT;
            }

            return result;
        } catch (e) {
            let errorHandler = handler[REQUEST_ERROR_HANDLER];  // custom handler by request
            if (_.isNil(errorHandler)) {
                // default of controller
                errorHandler = controller.__error;
            }
            if (_.isNil(errorHandler)) {
                // (global) default
                errorHandler = getRequestErrorHandler();
            }

            const CTX: RequestErrorHandlerContext = {
                error: e,
                request: req,
                response: res,
            };

            return await Promise.resolve(
                errorHandler.apply(controller, [
                    CTX
                ])
            );
        }
    };
}
