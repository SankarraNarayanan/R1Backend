
const express = require('express');
const app = express();
const cors = require('cors');
let bodyParser = require('body-parser');
const awsServerlessExpress = require('aws-serverless-express');
require('dotenv').config();
const routes = require('./router/route');


app.use(bodyParser.json({ limit: '200mb' }));
app.use(cors());

routes(app);

const PORT = 3000;
app.listen(PORT, () => {
    console.log('Listening at http://localhost:' + PORT + '/');
});

const server = awsServerlessExpress.createServer(app);

// Export Lambda handler
exports.lambdaHandler = (event, context) =>
    awsServerlessExpress.proxy(server, event, context);
