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
import { Controller, DecoratorFunction } from './index';
import { asArray, toBooleanSafe, toStringSafe } from './utils';

/**
 * A handler, that is invoked, if authorization failed.
 *
 * @param {AuthorizeFailedHandlerContext<TRequest>} context The context.
 */
export type AuthorizeFailedHandler<TRequest extends express.Request = express.Request> = (context: AuthorizeFailedHandlerContext<TRequest>) => any;

/**
 * The context for a handler, that is invoked, if authorization failed.
 */
export interface AuthorizeFailedHandlerContext<TRequest extends express.Request = express.Request> {
    /**
     * The reason from authorization handler.
     */
    reason?: any;
    /**
     * The current HTTP request context.
     */
    request: TRequest;
    /**
     * The list of resources to check.
     */
    resources: string[];
    /**
     * The current HTTP response context.
     */
    response: express.Response;
    /**
     * The result of the underlying handler.
     */
    result: AuthorizeHandlerResult;
    /**
     * The list of roles to check.
     */
    roles: string[];
}

/**
 * An authorization handler.
 *
 * @param {AuthorizeHandlerContext<TRequest>} context The context.
 *
 * @return {AuthorizeHandlerResult|PromiseLike<AuthorizeHandlerResult>} The result.
 */
export type AuthorizeHandler<TRequest extends express.Request = express.Request> = (context: AuthorizeHandlerContext<TRequest>) => AuthorizeHandlerResult | PromiseLike<AuthorizeHandlerResult>;

/**
 * The (execution) context of an authorization handler.
 */
export interface AuthorizeHandlerContext<TRequest extends express.Request = express.Request> {
    /**
     * Gets or sets an optional object or value,
     * which describes why the authorization failed.
     *
     * This value if submitted to the 'failed handler'.
     */
    reason?: any;
    /**
     * The current HTTP request context.
     */
    request: TRequest;
    /**
     * The list of resources to check.
     */
    resources: string[];
    /**
     * The current HTTP response context.
     */
    response: express.Response;
    /**
     * The list of roles to check.
     */
    roles: string[];
}

/**
 * The result of an authorization handler.
 */
export type AuthorizeHandlerResult = boolean | void | null | undefined | string;

/**
 * Options for an @Authorize decorator.
 */
export interface AuthorizeOptions {
    /**
     * The custom authorization handler.
     */
    authorize?: AuthorizeHandler;
    /**
     * The custom handler, if authorization failed.
     */
    onAuthorizeFailed?: AuthorizeFailedHandler;
    /**
     * One or more resource names.
     */
    resources?: string | string[];
    /**
     * One or more role names.
     */
    roles?: string | string[];
}


const AUTHORIZER_OPTIONS = Symbol('AUTHORIZER_OPTIONS');
let authorizationHandler: AuthorizeHandler;
let authorizationFailedHandler: AuthorizeFailedHandler;


/**
 * Sets up a controller method for authorization.
 *
 * @param {string|string[]} resources One or more resource names.
 * @param {AuthorizeFailedHandler} [onAuthorizeFailed] Custom handler, that is invoked if authorization failes.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function Authorize(resources: string | string[], onAuthorizeFailed?: AuthorizeFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for authorization.
 *
 * @param {string|string[]} roles One or more role names.
 * @param {string|string[]} resources One or more resource names.
 * @param {AuthorizeFailedHandler} [onAuthorizeFailed] Custom handler, that is invoked if authorization failes.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function Authorize(roles: string | string[], resources: string | string[], onAuthorizeFailed?: AuthorizeFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for authorization.
 *
 * @param {AuthorizeHandler} authorize The custom authorization handler.
 * @param {string|string[]} [resources] One or more resource names.
 * @param {AuthorizeFailedHandler} [onAuthorizeFailed] Custom handler, that is invoked if authorization failes.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function Authorize(authorize: AuthorizeHandler, resources?: string | string[], onAuthorizeFailed?: AuthorizeFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for authorization.
 *
 * @param {AuthorizeHandler} authorize The custom authorization handler.
 * @param {AuthorizeFailedHandler} onAuthorizeFailed Custom handler, that is invoked if authorization failes.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function Authorize(authorize: AuthorizeHandler, onAuthorizeFailed: AuthorizeFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for authorization.
 *
 * @param {AuthorizeHandler} authorize The custom authorization handler.
 * @param {string|string[]} roles One or more role names.
 * @param {string|string[]} resources One or more resource names.
 * @param {AuthorizeFailedHandler} [onAuthorizeFailed] Custom handler, that is invoked if authorization failes.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function Authorize(authorize: AuthorizeHandler, roles: string | string[], resources: string | string[], onAuthorizeFailed?: AuthorizeFailedHandler): DecoratorFunction;
/**
 * Sets up a controller method for authorization.
 *
 * @param {AuthorizeOptions} [opts] The custom options.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function Authorize(opts?: AuthorizeOptions): DecoratorFunction;
export function Authorize(
    ...args: any[]
): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        descriptor.value[AUTHORIZER_OPTIONS] = toAuthorizeOptions(args);
    };
}


/**
 * Creates a middleware for handling an 'Authorize()' decorator, if defined.
 *
 * @param {Controller} controller The controller.
 * @param {Function} method The underlying router method.
 */
export function createRouteAuthorizer(
    controller: Controller, method: Function
): express.RequestHandler {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const OPTS: AuthorizeOptions = method[AUTHORIZER_OPTIONS];
        if (!_.isNil(OPTS)) {
            let authorizer: AuthorizeHandler = OPTS.authorize;
            if (_.isNil(authorizer)) {
                authorizer = controller.__authorize;  // of controller
            }
            if (_.isNil(authorizer)) {
                authorizer = authorizationHandler;  // global
            }

            if (!_.isNil(authorizer)) {
                const AUTHORIZE_CTX: AuthorizeHandlerContext = {
                    reason: undefined,
                    request: req,
                    response: res,
                    resources: asArray(OPTS.resources)
                        .map(r => toStringSafe(r))
                        .filter(r => '' !== r.trim()),
                    roles: asArray(OPTS.roles)
                        .map(r => toStringSafe(r))
                        .filter(r => '' !== r.trim())
                };

                let authorizeResult = await Promise.resolve(
                    authorizer(AUTHORIZE_CTX)
                );

                if (_.isNil(authorizeResult)) {
                    authorizeResult = false;
                }

                let isAuthorized: boolean;
                if (_.isString(authorizeResult)) {
                    isAuthorized = '' === authorizeResult.trim();
                } else {
                    isAuthorized = toBooleanSafe(authorizeResult);
                }

                if (!isAuthorized) {
                    let failedHandler: AuthorizeFailedHandler = OPTS.onAuthorizeFailed;
                    if (_.isNil(failedHandler)) {
                        failedHandler = controller.__authorizeFailed;  // of controller
                    }
                    if (_.isNil(failedHandler)) {
                        failedHandler = authorizationFailedHandler;  // global
                    }

                    if (_.isNil(failedHandler)) {
                        // default

                        failedHandler = async (ctx) => {
                            if (_.isString(ctx.result)) {
                                return ctx.response.status(403)
                                    .send(ctx.result.trim());
                            }

                            return ctx.response.status(403)
                                .send();
                        };
                    }

                    const AUTHORIZE_FAILED_CTX: AuthorizeFailedHandlerContext = {
                        reason: AUTHORIZE_CTX.reason,
                        request: req,
                        response: res,
                        resources: AUTHORIZE_CTX.resources,
                        result: authorizeResult,
                        roles: AUTHORIZE_CTX.roles,
                    };

                    return Promise.resolve(
                        failedHandler(AUTHORIZE_FAILED_CTX)
                    );
                }
            }
        }

        return next();  // authorized or no handler defined
    };
}

/**
 * Returns the global handler, that is invoked if authorization of a request fails.
 *
 * @return {AuthorizeFailedHandler} The handler.
 */
export function getAuthorizeFailedHandler(): AuthorizeFailedHandler {
    return authorizationFailedHandler;
}

/**
 * Returns the global handler, that authorized requests.
 *
 * @return {AuthorizeHandler} The handler.
 */
export function getAuthorizeHandler(): AuthorizeHandler {
    return authorizationHandler;
}

/**
 * Sets the global handler, which is invoked if a request authorization fails.
 *
 * @param {AuthorizeFailedHandler|undefined|null} newHandler The new handler.
 */
export function setAuthorizeFailedHandler(
    newHandler: AuthorizeFailedHandler | undefined | null
): void {
    authorizationFailedHandler = newHandler;
}

/**
 * Sets the global handler, which authorizes requests.
 *
 * @param {AuthorizeHandler|undefined|null} newHandler The new handler.
 */
export function setAuthorizeHandler(
    newHandler: AuthorizeHandler | undefined | null
): void {
    authorizationHandler = newHandler;
}


function toAuthorizeOptions(args: any[]): AuthorizeOptions {
    let opts: AuthorizeOptions = {} as any;

    if (args.length) {
        const FIRST_ARG = args[0];

        if (
            _.isObjectLike(FIRST_ARG) &&
            !_.isArray(FIRST_ARG) &&
            !_.isString(FIRST_ARG)
        ) {
            // [0] opts: AuthorizeOptions

            opts = FIRST_ARG as AuthorizeOptions;
        } else {
            if (_.isFunction(FIRST_ARG)) {
                // [0] authorize: AuthorizeHandler

                opts = {
                    authorize: FIRST_ARG as AuthorizeHandler,
                };

                if (args.length > 1) {
                    if (_.isFunction(args[1])) {
                        // [1] onAuthorizeFailed: AuthorizeFailedHandler

                        opts.onAuthorizeFailed = args[1] as AuthorizeFailedHandler;
                    } else {
                        if (_.isFunction(args[2])) {
                            // [1] resources: string | string[];
                            // [2] onAuthorizeFailed: AuthorizeFailedHandler

                            opts.resources = args[1] as string | string[];
                            opts.onAuthorizeFailed = args[2] as AuthorizeFailedHandler;
                        } else {
                            // [1] roles: string | string[];
                            // [2] resources: string | string[];
                            // [3] onAuthorizeFailed?: AuthorizeFailedHandler

                            opts.roles = args[1] as string | string[];
                            opts.resources = args[2] as string | string[];
                            opts.onAuthorizeFailed = args[3] as AuthorizeFailedHandler;
                        }
                    }
                }
            } else {
                if (args.length < 2) {
                    // [0] resources: string | string[]

                    opts.resources = args[0] as string | string[];
                } else {
                    if (_.isFunction(args[1])) {
                        // [0] resources: string | string[]
                        // [1] onAuthorizeFailed?: AuthorizeFailedHandler

                        opts.resources = args[0] as string | string[];
                        opts.onAuthorizeFailed = args[1] as AuthorizeFailedHandler;
                    } else {
                        // [0] roles: string | string[]
                        // [1] resources: string | string[]
                        // [2] onAuthorizeFailed?: AuthorizeFailedHandler

                        opts.roles = args[0] as string | string[];
                        opts.resources = args[1] as string | string[];
                        opts.onAuthorizeFailed = args[2] as AuthorizeFailedHandler;
                    }
                }
            }
        }
    }

    return opts;
}
