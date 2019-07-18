import * as _ from 'lodash';
import * as express from 'express';
import * as swaggerUi from 'swagger-ui-express';
import * as yaml from 'js-yaml';
import { DecoratorFunction, ExpressApp } from './index';
import { asArray, isEmptyString, toStringSafe } from './utils';


/**
 * Possible value for an API url scheme.
 */
export type ApiUrlScheme = 'http' | 'https';

/**
 * General information of a Swagger document.
 */
export interface InitControllersSwaggerDocumentOptions {
    /**
     * The base path of the API.
     */
    basePath?: string;
    /**
     * External docs.
     */
    externalDocs?: SwaggerExternalDocs;
    /**
     * The host name.
     */
    host?: string;
    /**
     * Information about the document.
     */
    info?: SwaggerDocumentInfo;
    /**
     * The list of possible schemes.
     */
    schemes?: ApiUrlScheme | ApiUrlScheme[];
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
export interface InitControllersSwaggerOptions {
    /**
     * Custom CSS for the UI.
     */
    css?: string;
    /**
     * The list of definitions.
     */
    definitions?: {
        [name: string]: any,
    };
    /**
     * General document information.
     */
    document?: InitControllersSwaggerDocumentOptions;
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
}

/**
 * List of Swagger definitions.
 */
export type SwaggerDefinitionList = {
    [key: string]: any
};

/**
 * Information of a Swagger document.
 */
export interface SwaggerDocumentInfo {
    /**
     * Contact information.
     */
    contact?: SwaggerDocumentInfoContact;
    /**
     * API description.
     */
    description?: string;
    /**
     * License information.
     */
    license?: SwaggerDocumentInfoLicense;
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
export interface SwaggerDocumentInfoContact {
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
export interface SwaggerDocumentInfoLicense {
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
export interface SwaggerExternalDocs {
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
export interface SwaggerInfo {
    /**
     * The path definition.
     */
    pathInfo: SwaggerPathDefinition;
    /**
     * The route(r) path.
     */
    routePath?: string;
}


/**
 * A swagger path definition.
 */
export type SwaggerPathDefinition = any;

/**
 * Key for storing a SwaggerInfo document.
 */
export const SWAGGER_INFO = Symbol('SWAGGER_INFO');


/**
 * Sets up a controller method for a DELETE request.
 *
 * @param {SwaggerPathDefinition} pathDefinition The path definition.
 *
 * @return {DecoratorFunction} The decorator function.
 */
export function Swagger(pathDefinition: SwaggerPathDefinition): DecoratorFunction {
    return function (controllerConstructor: any, name: string, descriptor: PropertyDescriptor) {
        const VALUE: Function = descriptor.value;

        const INFO: SwaggerInfo = {
            pathInfo: pathDefinition,

        };

        VALUE[SWAGGER_INFO] = INFO;
    };
}


/**
 * Sets up the swagger UI for an app or router.
 *
 * @param {ExpressApp} app The Express app or router.
 * @param {InitControllersSwaggerOptions} opts Swagger options.
 * @param {SwaggerInfo[]} infos The list of infos.
 */
export function setupSwaggerUI(
    app: ExpressApp, opts: InitControllersSwaggerOptions,
    infos: SwaggerInfo[],
) {
    if (_.isNil(opts)) {
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
    const SWAGGER_DOC = {
        'swagger': '2.0',
        'info': undefined as SwaggerDocumentInfo,
        'host': undefined as string,
        'tags': undefined as any[],
        'schemes': undefined as string[],
        'paths': (infos.length ?
            {} : undefined) as any,
        'definitions': undefined as any,
        'externalDocs': undefined as any,
        'basePath': undefined as string,
        'securityDefinitions': undefined as SwaggerDefinitionList,
    };

    if (opts.document) {
        // basePath
        if (!isEmptyString(opts.document.basePath)) {
            SWAGGER_DOC.basePath = toStringSafe(opts.document.basePath)
                .trim();
        }

        // host
        if (!isEmptyString(opts.document.host)) {
            SWAGGER_DOC.host = toStringSafe(opts.document.host)
                .trim();
        }

        // schemes
        const ALL_SCHEMES = asArray(opts.document.schemes)
            .map(x => toStringSafe(x).toLowerCase().trim())
            .filter(x => '' !== x)
            .sort();
        if (ALL_SCHEMES.length) {
            SWAGGER_DOC.schemes = ALL_SCHEMES;
        }

        // externalDocs
        if (opts.document.externalDocs) {
            SWAGGER_DOC.externalDocs = opts.document.externalDocs;
        }

        // info
        if (opts.document.info) {
            SWAGGER_DOC.info = opts.document.info;
        }

        // securityDefinitions
        if (opts.document.securityDefinitions) {
            SWAGGER_DOC.securityDefinitions = opts.document.securityDefinitions;
        }
    }

    if (opts.document.tags) {
        SWAGGER_DOC.tags = [];

        for (const T in opts.document.tags) {
            const TAG_NAME = T.trim();
            const TAG_DESCRIPTION = toStringSafe(opts.document.tags[T])
                .trim();

            SWAGGER_DOC.tags.push({
                name: TAG_NAME,
                description: TAG_DESCRIPTION,
            });
        }
    }

    let css = toStringSafe(opts.css);
    if (isEmptyString(css)) {
        css = null;
    }

    let favIcon = toStringSafe(opts.favIcon);
    if (isEmptyString(favIcon)) {
        favIcon = null;
    }

    let url = toStringSafe(opts.url);
    if (isEmptyString(url)) {
        url = null;
    }

    let title = toStringSafe(opts.title);
    if (isEmptyString(title)) {
        title = null;
    }

    if (SWAGGER_DOC.definitions) {
        SWAGGER_DOC.definitions = {};

        for (const DN of Object.keys(SWAGGER_DOC.definitions)) {
            const DEF_NAME = DN.trim();
            if ('' === DEF_NAME) {
                continue;
            }

            SWAGGER_DOC.definitions[DEF_NAME] = SWAGGER_DOC.definitions[DN];
        }
    }

    if (infos.length) {
        for (const SI of infos) {
            SWAGGER_DOC.paths[SI.routePath] = SI.pathInfo;
        }
    }

    const ROUTER = express.Router();

    ROUTER.use('/', swaggerUi.serveFiles(SWAGGER_DOC));
    ROUTER.get('/', swaggerUi.setup(
        SWAGGER_DOC,
        null,  // opts
        null,  // options
        css,  // customCss
        favIcon,  // customfavIcon
        url,  // swaggerUrl
        title,  // customeSiteTitle
    ));

    // download link (JSON)
    ROUTER.get(`/json`, function (req, res) {
        return res.status(200)
            .header('content-type', 'application/json; charset=utf-8')
            .header('content-disposition', `attachment; filename=api.json`)
            .send(
                Buffer.from(JSON.stringify(SWAGGER_DOC, null, 2),
                    'utf8')
            );
    });

    // download link (YAML)
    ROUTER.get(`/yaml`, function (req, res) {
        return res.status(200)
            .header('content-type', 'application/x-yaml; charset=utf-8')
            .header('content-disposition', `attachment; filename=api.yaml`)
            .send(
                Buffer.from(yaml.safeDump(SWAGGER_DOC),
                    'utf8')
            );
    });

    app.use(swaggerRoot, ROUTER);
}
