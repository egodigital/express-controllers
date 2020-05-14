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
import * as swaggerUi from 'swagger-ui-express';
import * as yaml from 'js-yaml';
import { AUTHORIZER_OPTIONS } from './authorize';
import { DecoratorFunction, IController, REQUEST_VALIDATORS, ExpressApp } from './index';
import { asArray, compareValuesBy, isEmptyString, normalizeString, toBooleanSafe, toStringSafe } from './utils';

/**
 * Possible value for an API url scheme.
 */
export type ApiUrlScheme = 'http' | 'https';

/**
 * General information of a Swagger document.
 */
export interface IInitControllersSwaggerDocumentOptions {
    /**
     * The base path of the API.
     */
    basePath?: string;
    /**
     * External docs.
     */
    externalDocs?: ISwaggerExternalDocs;
    /**
     * The host name.
     */
    host?: string;
    /**
     * Information about the document.
     */
    info?: ISwaggerDocumentInfo;
    /**
     * The list of possible schemes.
     */
    schemes?: ApiUrlScheme | ApiUrlScheme[];
    /**
     * Global security definitions.
     */
    security?: SwaggerSecurityDefintion[];
    /**
     * Security definitions.
     */
    securityDefinitions?: SwaggerDefinitionList;
    /**
     * List of tags (key => name; value => description).
     */
    tags?: { [name: string]: string };
}

/**
 * 'swagger' extension for options of 'initControllers()' function.
 */
export interface IInitControllersSwaggerOptions {
    /**
     * Support download of YAML and JSON files or not. Default: (true)
     */
    canDownload?: boolean;
    /**
     * Custom CSS for the UI.
     */
    css?: string;
    /**
     * The list of definitions.
     */
    definitions?: {
        [name: string]: any;
    };
    /**
     * General document information.
     */
    document?: IInitControllersSwaggerDocumentOptions;
    /**
     * Custom Favicon for the UI.
     */
    favIcon?: string;
    /**
     * The custom root endpoint (name). Default: '/swagger'
     */
    root?: string;
    /**
     * Custom site title.
     */
    title?: string;
    /**
     * Custom (Swagger) URL.
     */
    url?: string;
    /**
     * One or more, optional middlewares to use.
     */
    use?: express.RequestHandler | express.RequestHandler[];
}

/**
 * A possible value for 'swagger' property of 'InitControllersSwaggerOptions' interface.
 *
 * (false) indicates NOT to setup Swagger UI.
 */
export type InitControllersSwaggerOptionsValue = IInitControllersSwaggerOptions | false;

/**
 * Information of a Swagger document.
 */
export interface ISwaggerDocumentInfo {
    /**
     * Contact information.
     */
    contact?: ISwaggerDocumentInfoContact;
    /**
     * API description.
     */
    description?: string;
    /**
     * License information.
     */
    license?: ISwaggerDocumentInfoLicense;
    /**
     * Version.
     */
    version?: string;
    /**
     * The title.
     */
    title?: string;
}

/**
 * Contact information in the 'info' block of a Swagger document.
 */
export interface ISwaggerDocumentInfoContact {
    /**
     * The email address.
     */
    email?: string;
    /**
     * The display name of the contact.
     */
    name?: string;
    /**
     * The URL.
     */
    url?: string;
}

/**
 * License information in the 'info' block of a Swagger document.
 */
export interface ISwaggerDocumentInfoLicense {
    /**
     * The display name of the license.
     */
    name?: string;
    /**
     * The URL.
     */
    url?: string;
}

/**
 * Swagger external documentation information.
 */
export interface ISwaggerExternalDocs {
    /**
     * A description.
     */
    description?: string;
    /**
     * The URL to the documentation.
     */
    url?: string;
}

/**
 * Information for generating a Swagger document (path definition).
 */
export interface ISwaggerInfo {
    /**
     * The underlying controller.
     */
    controller?: IController<unknown>;
    /**
     * The underlying controller method.
     */
    controllerMethod?: Function;
    /**
     * The controller's root path.
     */
    controllerRootPath?: string;
    /**
     * List of router methods, grouped by paths.
     */
    groupedRouterMethods: {
        [path: string]: string[];
    };
    /**
     * List of supported methods.
     */
    methods?: string[];
    /**
     * Custom options.
     */
    options?: ISwaggerOptions;
    /**
     * The path definition.
     */
    pathDefinition: SwaggerPathDefinition;
}

/**
 * Additional, custom options for 'Swagger()' decorator.
 */
export interface ISwaggerOptions {
    /**
     * A function that updates swagger path definitions.
     */
    pathDefinitionUpdater?: SwaggerPathDefinitionUpdater;
}

/**
 * An execution context for a 'SwaggerPathDefinitionUpdater' function.
 */
export interface ISwaggerPathDefinitionUpdaterContext {
    /**
     * The path definition to update.
     */
    definition: SwaggerPathDefinition;
    /**
     * Indicates if endpoint does validate or not.
     */
    doesValidate: boolean;
    /**
     * Indicates if underlying method is marked with 'Authorize()' decorator or not.
     */
    hasAuthorize: boolean;
    /**
     * The HTTP method.
     */
    method: string;
    /**
     * The route path.
     */
    path: string;
}

/**
 * List of Swagger definitions.
 */
export type SwaggerDefinitionList = {
    [key: string]: any;
};

/**
 * A swagger path definition.
 */
export type SwaggerPathDefinition = any;

/**
 * Updates a Swagger path definition.
 *
 * @param {ISwaggerPathDefinitionUpdaterContext} context The context.
 */
export type SwaggerPathDefinitionUpdater =
    (context: ISwaggerPathDefinitionUpdaterContext) => any;

/**
 * A security defintion.
 */
export type SwaggerSecurityDefintion = { [name: string]: any[] };

/**
 * Key for storing a SwaggerInfo document.
 */
export const SWAGGER_INFO = Symbol('SWAGGER_INFO');
let swaggerPathDefinitionUpdater: SwaggerPathDefinitionUpdater;


/**
 * Defines a Swagger definition for a controller method.
 *
 * @param {SwaggerPathDefinition} pathDefinition The path definition.
 * @param {ISwaggerOptions} [opts] Custom and additional options.
 *
 * @returns {DecoratorFunction} The decorator function.
 */
export function Swagger(pathDefinition: SwaggerPathDefinition, opts?: ISwaggerOptions): DecoratorFunction;
/**
 * Defines a Swagger definition for a controller method.
 *
 * @param {SwaggerPathDefinition} pathDefinition The path definition.
 * @param {SwaggerPathDefinitionUpdater} pathDefinitionUpdater A function that updates path definitions.
 *
 * @returns {DecoratorFunction} The decorator function.
 */
export function Swagger(pathDefinition: SwaggerPathDefinition, pathDefinitionUpdater: SwaggerPathDefinitionUpdater): DecoratorFunction;
/**
 * Defines a Swagger definition for a controller method.
 *
 * @param {SwaggerPathDefinitionUpdater} pathDefinitionUpdater A function that updates path definitions.
 * @param {SwaggerPathDefinition} pathDefinition The path definition.
 *
 * @returns {DecoratorFunction} The decorator function.
 */
export function Swagger(pathDefinitionUpdater: SwaggerPathDefinitionUpdater, pathDefinition: SwaggerPathDefinition): DecoratorFunction;
export function Swagger(...args: any[]): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        const VALUE: Function = descriptor.value;

        VALUE[SWAGGER_INFO] = toSwaggerInfo(args);
    };
}


/**
 * Returns the global function, for updating Swagger path definitions.
 *
 * @returns {SwaggerPathDefinitionUpdater} The handler.
 */
export function getSwaggerPathDefinitionUpdater(): SwaggerPathDefinitionUpdater {
    return swaggerPathDefinitionUpdater;
}

/**
 * Sets the global function, for updating Swagger path definitions.
 *
 * @param {SwaggerPathDefinitionUpdater|undefined|null} newUpdater The new handler.
 */
export function setSwaggerPathDefinitionUpdater(
    newUpdater: SwaggerPathDefinitionUpdater | null | undefined,
): void {
    swaggerPathDefinitionUpdater = newUpdater;
}

/**
 * Sets up the swagger UI for an app or router.
 *
 * @param {ExpressApp} app The Express app or router.
 * @param {InitControllersSwaggerOptionsValue} optsOrFalse Swagger options.
 * @param {SwaggerInfo[]} infos The list of infos.
 */
export function setupSwaggerUI(
    app: ExpressApp, optsOrFalse: InitControllersSwaggerOptionsValue,
    infos: ISwaggerInfo[],
) {
    if (false === optsOrFalse) {
        return;
    }

    let opts = optsOrFalse as IInitControllersSwaggerOptions;

    if (_.isNil(opts)) {
        opts = {} as any;
    }

    if (!infos.length) {
        return;
    }

    // swagger root path
    let swaggerRoot = toStringSafe(opts.root);
    if ('' === swaggerRoot.trim()) {
        swaggerRoot = '/swagger';
    }
    if (!swaggerRoot.trim().startsWith('/')) {
        swaggerRoot = '/' + swaggerRoot;
    }

    // prepare version 2.0 document
    let newSwaggerDoc = {
        swagger: '2.0',
        info: undefined as any,
        host: undefined as any,
        tags: undefined as any,
        schemes: undefined as any,
        paths: (infos.length ?
            {} : undefined) as any,
        definitions: undefined as any,
        externalDocs: undefined as any,
        basePath: undefined as any,
        securityDefinitions: undefined as any
    };

    if (opts.document) {
        // basePath
        if (!isEmptyString(opts.document.basePath)) {
            newSwaggerDoc.basePath = toStringSafe(opts.document.basePath)
                .trim();
        }

        // host
        if (!isEmptyString(opts.document.host)) {
            newSwaggerDoc.host = toStringSafe(opts.document.host)
                .trim();
        }

        // schemes
        const ALL_SCHEMES = asArray(opts.document.schemes)
            .map(x => toStringSafe(x).toLowerCase().trim())
            .filter(x => '' !== x)
            .sort();
        if (ALL_SCHEMES.length) {
            newSwaggerDoc.schemes = ALL_SCHEMES;
        }

        // externalDocs
        if (opts.document.externalDocs) {
            newSwaggerDoc.externalDocs = opts.document.externalDocs;
        }

        // info
        if (opts.document.info) {
            newSwaggerDoc.info = opts.document.info;
        }

        // securityDefinitions
        if (opts.document.securityDefinitions) {
            newSwaggerDoc.securityDefinitions = opts.document.securityDefinitions;
        }

        // tags
        if (opts.document.tags) {
            newSwaggerDoc.tags = [];

            // sort by tag name
            Object.keys(opts.document.tags).sort((x, y) => compareValuesBy(x, y, t => normalizeString(t))).forEach(t => {
                const TAG_NAME = t.trim();
                const TAG_DESCRIPTION = toStringSafe(opts.document.tags[t])
                    .trim();

                newSwaggerDoc.tags.push({
                    name: TAG_NAME,
                    description: TAG_DESCRIPTION
                });
            });
        }
    }

    // custom CSS
    let css = toStringSafe(opts.css);
    if (isEmptyString(css)) {
        css = null;
    }

    // fav icon
    let favIcon = toStringSafe(opts.favIcon);
    if (isEmptyString(favIcon)) {
        favIcon = null;
    }

    // Swagger URL
    let url = toStringSafe(opts.url);
    if (isEmptyString(url)) {
        url = null;
    }

    // custom site title
    let title = toStringSafe(opts.title);
    if (isEmptyString(title)) {
        title = null;
    }

    if (opts.definitions) {
        newSwaggerDoc.definitions = {};

        // sort by name
        Object.keys(opts.definitions).sort((x, y) => compareValuesBy(x, y, dn => normalizeString(dn))).forEach(dn => {
            const DEF_NAME = dn.trim();
            if ('' === DEF_NAME) {
                return;
            }

            newSwaggerDoc.definitions[DEF_NAME] = opts.definitions[dn];
        });
    }

    if (newSwaggerDoc.paths) {
        // path definitions

        const PATH_ACTIONS: {
            action: () => void;
            swaggerPath: string;
        }[] = [];

        infos.forEach(si => {
            Object.keys(si.groupedRouterMethods).forEach(routePath => {
                const SWAGGER_PATH = toSwaggerPath(routePath);

                PATH_ACTIONS.push({
                    swaggerPath: SWAGGER_PATH,
                    action: () => {
                        if (_.isNil(newSwaggerDoc.paths[SWAGGER_PATH])) {
                            newSwaggerDoc.paths[SWAGGER_PATH] = {};
                        }

                        // set for each method
                        si.groupedRouterMethods[routePath].sort().forEach(m => {
                            let pathDefinition = si.pathDefinition;
                            let pathDefinitionUpdater: SwaggerPathDefinitionUpdater;

                            if (si.options) {
                                pathDefinitionUpdater = si.options.pathDefinitionUpdater;
                            }

                            if (_.isNil(pathDefinitionUpdater)) {
                                pathDefinitionUpdater = si.controller.__updateSwaggerPath;  // controller-wide
                            }
                            if (_.isNil(pathDefinitionUpdater)) {
                                pathDefinitionUpdater = getSwaggerPathDefinitionUpdater();  // global
                            }

                            if (pathDefinitionUpdater) {
                                const UPDATER_CTX: ISwaggerPathDefinitionUpdaterContext = {
                                    definition: pathDefinition,
                                    doesValidate: !!asArray(si.controllerMethod[REQUEST_VALIDATORS]).length,
                                    hasAuthorize: !_.isNil(si.controllerMethod[AUTHORIZER_OPTIONS]),
                                    method: m.toUpperCase(),
                                    path: routePath
                                };

                                pathDefinitionUpdater(
                                    UPDATER_CTX
                                );

                                pathDefinition = UPDATER_CTX.definition;
                            }

                            if (pathDefinition) {
                                newSwaggerDoc.paths[SWAGGER_PATH][m] = pathDefinition;
                            }
                        });
                    }
                });
            });
        });

        // sort by Swagger path
        PATH_ACTIONS.sort((x, y) => compareValuesBy(x, y, i => normalizeString(i.swaggerPath))).forEach(pa => {
            pa.action();
        });
    }

    const ROUTER = express.Router();

    // setup UI
    {
        const MIDDLEWARES = asArray(opts.use);
        if (MIDDLEWARES.length) {
            // additional middlewares

            ROUTER.use.apply(
                ROUTER, MIDDLEWARES
            );
        }

        ROUTER.use('/', swaggerUi.serveFiles(newSwaggerDoc));
        ROUTER.get('/', swaggerUi.setup(
            newSwaggerDoc,
            null,  // opts
            null,  // options
            css,  // customCss
            favIcon,  // customfavIcon
            url,  // swaggerUrl
            title,  // customeSiteTitle
        ));
    }

    // we need a clean object here
    newSwaggerDoc = JSON.parse(
        JSON.stringify(newSwaggerDoc)
    );

    if (toBooleanSafe(opts.canDownload, true)) {
        // download link (JSON)
        const JSON_DOC = JSON.stringify(newSwaggerDoc, null, 2);
        ROUTER.get('/json', function (req, res) {
            return res.status(200)
                .header('content-type', 'application/json; charset=utf-8')
                .header('content-disposition', 'attachment; filename=api.json')
                .send(
                    Buffer.from(JSON_DOC, 'utf8')
                );
        });

        // download link (YAML)
        const YAML_DOC = yaml.safeDump(newSwaggerDoc);
        ROUTER.get('/yaml', function (req, res) {
            return res.status(200)
                .header('content-type', 'application/x-yaml; charset=utf-8')
                .header('content-disposition', 'attachment; filename=api.yaml')
                .send(
                    Buffer.from(YAML_DOC, 'utf8')
                );
        });
    }

    app.use(swaggerRoot, ROUTER);
}


function toSwaggerInfo(args: any[]): ISwaggerInfo {
    const INFO: ISwaggerInfo = {
        groupedRouterMethods: {},
        pathDefinition: undefined
    };

    const FIRST_ARG: any = args[0];

    if (_.isFunction(FIRST_ARG)) {
        // [0] pathDefinitionUpdater: SwaggerPathDefinitionUpdater
        // [1] pathDefinition: SwaggerPathDefinition

        INFO.pathDefinition = args[1] as SwaggerPathDefinition;
        INFO.options = {
            pathDefinitionUpdater: FIRST_ARG as SwaggerPathDefinitionUpdater
        };
    } else {
        // [0] pathDefinition: SwaggerPathDefinition

        INFO.pathDefinition = FIRST_ARG as SwaggerPathDefinition;

        if (args.length > 1) {
            if (_.isFunction(args[1])) {
                // [1] pathDefinitionUpdater: SwaggerPathDefinitionUpdater

                INFO.options = {
                    pathDefinitionUpdater: args[1] as SwaggerPathDefinitionUpdater
                };
            } else {
                // [1] opts?: ISwaggerOptions

                INFO.options = args[1] as ISwaggerOptions;
            }
        }
    }

    return INFO;
}

function toSwaggerPath(p: string) {
    p = p.replace(
        /(\:)([^\/|^\(|^\)]+)([\/|\(|\)]?)/ig,
        '{$2}$3'
    );

    return p;
}
