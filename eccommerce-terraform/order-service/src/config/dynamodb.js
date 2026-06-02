const AWS = require('aws-sdk');

// DynamoDB config
const dynamo = new AWS.DynamoDB.DocumentClient({
  region: 'ap-southeast-1'
});

const ORDER_TABLE = 'asif-order';

module.exports = { dynamo, ORDER_TABLE };
