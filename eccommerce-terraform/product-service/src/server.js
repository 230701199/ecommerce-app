require('dotenv').config();

const serverless = require('serverless-http');
const { createApp } = require('./app');

const app = createApp();

// Lambda handler
module.exports.handler = serverless(app);
