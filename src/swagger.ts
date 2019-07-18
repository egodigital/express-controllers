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
     * List of supported methods.
     */
    methods?: string[];
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
        'swagger': '2.0',
        'info': undefined as any,
        'host': undefined as any,
        'tags': undefined as any,
        'schemes': undefined as any,
        'paths': (infos.length ?
            {} : undefined) as any,
        'definitions': undefined as any,
        'externalDocs': undefined as any,
        'basePath': undefined as any,
        'securityDefinitions': undefined as any,
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

            for (const T in opts.document.tags) {
                const TAG_NAME = T.trim();
                const TAG_DESCRIPTION = toStringSafe(opts.document.tags[T])
                    .trim();

                newSwaggerDoc.tags.push({
                    name: TAG_NAME,
                    description: TAG_DESCRIPTION,
                });
            }
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

        for (const DN of Object.keys(opts.definitions)) {
            const DEF_NAME = DN.trim();
            if ('' === DEF_NAME) {
                continue;
            }

            newSwaggerDoc.definitions[DEF_NAME] = opts.definitions[DN];
        }
    }

    if (newSwaggerDoc.paths) {
        // path definitions

        for (const SI of infos) {
            newSwaggerDoc.paths[SI.routePath] = {};

            // set for each method
            for (const METHOD of SI.methods.sort()) {
                newSwaggerDoc.paths[SI.routePath][METHOD] = SI.pathInfo;
            }
        }
    }

    const ROUTER = express.Router();

    // setup UI
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

    // we need a clean object here
    newSwaggerDoc = JSON.parse(
        JSON.stringify(newSwaggerDoc)
    );

    // download link (JSON)
    const JSON_DOC = JSON.stringify(newSwaggerDoc, null, 2);
    ROUTER.get(`/json`, function (req, res) {
        return res.status(200)
            .header('content-type', 'application/json; charset=utf-8')
            .header('content-disposition', `attachment; filename=api.json`)
            .send(
                Buffer.from(JSON_DOC, 'utf8')
            );
    });

    // download link (YAML)
    const YAML_DOC = yaml.safeDump(newSwaggerDoc);
    ROUTER.get(`/yaml`, function (req, res) {
        return res.status(200)
            .header('content-type', 'application/x-yaml; charset=utf-8')
            .header('content-disposition', `attachment; filename=api.yaml`)
            .send(
                Buffer.from(YAML_DOC, 'utf8')
            );
    });

    app.use(swaggerRoot, ROUTER);
}
