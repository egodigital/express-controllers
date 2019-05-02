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

    // define one or more middlewares
    // for each route endpoint
    public __use = [
        express.urlencoded({ extended: true }),
    ];
}
