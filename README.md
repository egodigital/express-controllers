# express-controllers

Sets up controllers, which are running with [Express.js](@egodigital/express-controllers).

## Install

Execute the following command from your project folder, where your `package.json` file is stored:

```bash
npm install --save @egodigital/express-controllers
```

## Usage

### Build

```bash
# install modules
npm install

# build
npm run build
```

### Examples

### Quick start

First create a root directory, where all your controllers will be stored and implemented, lets say `/controllers`.

Then create a `/controllers/index.ts` (if using [TypeScript](https://www.typescriptlang.org/)) and implement an exported / public `Controller` class with the following skeleton:

```typescript
import * as joi from 'joi';
import { Request, Response } from 'express';
import { ControllerBase, GET, POST } from '../../../index';

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

To run the example, simply execute

```bash
npm run example:quick_start
```

from your command line.

### Serialize

```typescript
import { Request, Response } from 'express';
import { ControllerBase, GET, ResponseSerializerContext } from '../../../index';

/**
 * /controllers/index.ts
 *
 * Base path: '/'
 */
export class Controller extends ControllerBase {
    // serialize the results of any
    // controller route method and
    // send each as response
    public __serialize(context: ResponseSerializerContext) {
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
        // send by '__serialize()' (s. below)
        return {
            success: true,
            data: {
                'TM': '1979-09-05 23:09'
            },
        };
    }
}
```

To run the example, simply execute

```bash
npm run example:serialize
```

from your command line.

### Middlewares

```typescript
import * as express from 'express';
import { ControllerBase, POST } from '../../../index';

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
    @POST({
        path: '/users',
    })
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

To run the example, simply execute

```bash
npm run example:middlewares
```

from your command line.
