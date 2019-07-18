[![npm](https://img.shields.io/npm/v/@egodigital/express-controllers.svg)](https://www.npmjs.com/package/@egodigital/express-controllers)

# express-controllers

Sets up controllers, which are running with [Express.js](https://expressjs.com/).

## Install

Execute the following command from your project folder, where your `package.json` file is stored:

```bash
npm install --save @egodigital/express-controllers
```

## Samples

Example code can be found in [express-controllers-samples](https://github.com/egodigital/express-controllers-samples) repository.

## Usage

### Build

```bash
# install modules
npm install

# build
npm run build
```

### Requirements

#### TypeScript

You have to enable [decorator](https://www.typescriptlang.org/docs/handbook/decorators.html) feature in your `tsconfig.json` file:

```jsonc
{
    "compilerOptions": {
        // ...

        "experimentalDecorators": true
    },
    
    // ...
}
```

### Examples

### Quick start

First create a root directory, where all your controllers will be stored and implemented, lets say `/controllers`.

Then create a `/controllers/index.ts` (if using [TypeScript](https://www.typescriptlang.org/)) and implement an exported / public `Controller` class with the following skeleton:

```typescript
import * as joi from 'joi';
import { Request, Response } from 'express';
import { ControllerBase, GET, POST } from '@egodigital/express-controllers';

interface INewUser {
    email?: string;
    password: string;
    username: string;
}

const NEW_USER_SCHEMA = joi.object({
    email: joi.string()
        .optional(),
    password: joi.string()
        .min(1)
        .required(),
    username: joi.string()
        .required(),
});

/**
 * /controllers/index.ts
 *
 * Base path: '/'
 */
export class Controller extends ControllerBase {
    /**
     * [GET] / endpoint
     *
     * 'index' will mapped to realtive '/' path by default.
     */
    @GET()
    public async index(req: Request, res: Response) {
        return res.status(200)
            .send('Hello, e.GO!');
    }

    /**
     * [GET] /foo endpoint
     *
     * Other method names than 'index', will always be mapped
     * to realtive '/{METHOD_NAME}' path
     */
    @GET()
    public async foo(req: Request, res: Response) {
        return res.status(200)
            .send('Hello, foo!');
    }

    /**
     * [POST] /foo/:foo_id endpoint
     *
     * Define relative path explicitly.
     */
    @POST('/foo/:foo_id')
    public async foo_with_post(req: Request, res: Response) {
        return res.status(200)
            .send('Hello, foo.POST: ' + req.params['foo_id']);
    }

    /**
     * [POST] /users endpoint
     *
     * Check JSON input via joi schema.
     */
    @POST({
        path: '/users',
        schema: NEW_USER_SCHEMA,
    })
    public async create_new_user(req: Request, res: Response) {
        const NEW_USER: INewUser = req.body;

        // TODO ...

        return res.status(200)
            .send('Created new user: ' + NEW_USER.username);
    }
}
```

For loading and initializing the controllers from `/controllers`, simply create a `/index.ts` file and use the following code snippet:

```typescript
import * as express from 'express';
import { initControllers } from '@egodigital/express-controllers';

const app = express();

initControllers({
    app,
    cwd: __dirname + '/controllers',
});

app.listen(8080, () => {
    // server now running
});
```

The library will scan the complete `/controllers` folder structure and map the endpoints by that structure.

You can also use other filenames as `index.ts`. For example, if you would like to implement a `/foo/bar` endpoint, create a `/controllers/foo/bar.ts` and use the following snippet:

```typescript
import { Request, Response } from 'express';
import { ControllerBase, GET } from '@egodigital/express-controllers';

/**
 * /controllers/foo/bar.ts
 *
 * Base path: '/foo/bar'
 */
export class Controller extends ControllerBase {
    /**
     * [GET] /foo/bar endpoint
     */
    @GET()
    public async index(req: Request, res: Response) {
        // TODO
    }

    /**
     * [GET] /foo/bar/xyz endpoint
     */
    @GET()
    public async xyz(req: Request, res: Response) {
        // TODO
    }

    /**
     * [GET] /foo/bar/tm endpoint
     */
    @GET('/tm')
    public async xyz(req: Request, res: Response) {
        // TODO
    }
}
```

### Serialize

```typescript
import { Request, Response } from 'express';
import { ControllerBase, GET, ResponseSerializerContext } from '@egodigital/express-controllers';

/**
 * /controllers/index.ts
 *
 * Base path: '/'
 */
export class Controller extends ControllerBase {
    // serialize the results of any
    // controller route method and
    // send each as response
    public async __serialize(context: ResponseSerializerContext) {
        return context.response
            .header('Content-Type', 'application/json')
            .send(JSON.stringify(
                context.result  // result of 'index()', e.g.
            ));
    }

    /**
     * [GET] / relative endpoint
     */
    @GET()
    public async index(req: Request, res: Response) {
        // this object is serialized and
        // send by '__serialize()' (s. above)
        return {
            success: true,
            data: {
                'TM': '1979-09-05 23:09'
            },
        };
    }
}
```

### Middlewares

```typescript
import * as express from 'express';
import { ControllerBase, POST } from '@egodigital/express-controllers';

interface INewUser {
    email?: string;
    password: string;
    username: string;
}

/**
 * /controllers/index.ts
 *
 * Base path: '/'
 */
export class Controller extends ControllerBase {
    // define one or more middlewares
    // for each route endpoint
    public __use = [
        express.urlencoded({ extended: true }),
    ];

    /**
     * [POST] /users endpoint
     */
    @POST('/users')
    public async new_user(req: express.Request, res: express.Response) {
        const NEW_USER: INewUser = req.body;

        // TODO ...

        return res.status(200)
            .send('Created new user: ' + JSON.stringify(
                NEW_USER, null, 2
            ));
    }
}
```

### Error handling

```typescript
import * as express from 'express';
import { ControllerBase, GET, RequestErrorHandlerContext } from '@egodigital/express-controllers';

/**
 * /controllers/index.ts
 *
 * Base path: '/'
 */
export class Controller extends ControllerBase {
    // handle exceptions
    public async __error(context: RequestErrorHandlerContext) {
        return context.response
            .status(500)
            .send('SERVER ERROR: ' + context.error);
    }

    /**
     * [GET] / endpoint
     */
    @GET()
    public async index(req: express.Request, res: express.Response) {
        // all request error, like that
        // will be handled by
        // '__error()' method
        throw new Error('Test error!');
    }
}
```

### Authorize

```typescript
import * as express from 'express';
import { Authorize, AuthorizeFailedHandlerContext, AuthorizeHandlerContext, ControllerBase, GET, RequestErrorHandlerContext } from '@egodigital/express-controllers';

/**
 * /controllers/index.ts
 *
 * Base path: '/'
 */
export class Controller extends ControllerBase {
    // check if authorized
    public async __authorize(context: AuthorizeHandlerContext) {
        // return (true) or (false)
        // or a non empty string, which is returned as error message by default

        // default: (false)

        return 'The authorization has been failed';
    }

    // handle failed authorization
    public async __authorizeFailed(context: AuthorizeFailedHandlerContext) {
        // s. result of __authorize()
        const ERROR_MSG = context.result as string;

        return context.response
            .status(401)
            .send('AUTHORIZE FAILED: ' + ERROR_MSG);
    }


    /**
     * [GET] / endpoint
     */
    @Authorize()
    @GET()
    public async index(req: express.Request, res: express.Response) {
        // this will only be invoked
        // if __authorize() returns (true)
        // or nothing (null, undefined or empty string)

        return res.status(204)
            .send();
    }
}
```

### Swagger

First define the main information of the document:

```typescript
import * as express from 'express';
import { initControllers } from '@egodigital/express-controllers';

const app = express();

initControllers({
    app,
    cwd: __dirname + '/controllers',
    swagger: {
        definitions: {
            'SuccessResponse': {
                "type": "object",
                "properties": {
                    "success": {
                        "description": "Indicates if operation was successful or not.",
                        "type": "boolean"
                    },
                    "data": {
                        "description": "The result data.",
                        "type": "string"
                    },
                }
            }
        },
        document: {
            host: 'api.example.com',
            info: {
                contact: {
                    email: "hello@e-go-digital.com",
                },
                description: "Describes all API endpoints.",
                title: "Test API",
                version: "1.0.0",
            },
            schemes: ['http', 'https'],
            tags: {
                'test': 'A test tag',
            },
        },
        title: 'Swagger Test',
    },
});

app.listen(8080, () => {
    console.log('Swagger document: http://localhost:8080/swagger');
});
```

Now use `@Swagger` decorator for each of your method, to document your API:

```typescript
import { Request, Response } from 'express';
import { ControllerBase, GET, Swagger, SwaggerPathDefinitionUpdaterContext } from '@egodigital/express-controllers';

/**
 * /controllers/api/index.ts
 *
 * Base path: '/api'
 */
export class Controller extends ControllerBase {
    /**
     * [GET]  /api
     */
    @GET()
    @Swagger({
        "tags": [
            "test"
        ],
        "summary": "A test.",
        "produces": [
            "application/json"
        ],
        "parameters": [
            {
                "in": "header",
                "name": "X-My-Header",
                "required": false,
                "type": "string"
            },
        ],
        "responses": {
            "200": {
                "description": "Operation was successful.",
                "schema": {
                    "$ref": "#/definitions/SuccessResponse",
                }
            },
        }
    }, pathDefinitionUpdater)
    public async index(req: Request, res: Response) {
        return res.json({
            success: true,
            data: 'Swagger test: OK',
        });
    }
}


// update each path definition with default values
function pathDefinitionUpdater(ctx: SwaggerPathDefinitionUpdaterContext) {
    // Bad Request
    ctx.definition['responses']['400'] = {
        "description": "Bad request!"
    };

    // Internal Server Error
    ctx.definition['responses']['500'] = {
        "description": "Operation was failed!"
    };
}
```

## Documentation

The API documentation can be found [here](https://egodigital.github.io/express-controllers/).
