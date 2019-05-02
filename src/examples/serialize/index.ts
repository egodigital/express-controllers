import * as express from 'express';
import { initControllers } from '../../index';

const app = express();

initControllers({
    app,
    cwd: __dirname + '/controllers',
});

app.listen(8080, () => {
    console.log('Serialize example now runs on port 8080 ...');
});
