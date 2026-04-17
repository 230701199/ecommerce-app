const serverless = require('serverless-http');
const app = require('./order');
module.exports = app;
module.exports.handler = serverless(app);