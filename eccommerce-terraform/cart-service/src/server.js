require('dotenv').config();

const express = require('express');
const AWS = require('aws-sdk');
const serverless = require('serverless-http');

const app = express();
app.use(express.json());

const dynamo = new AWS.DynamoDB.DocumentClient({ region: 'ap-southeast-1' });
const TABLE = 'asif-cart';

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Cart service running' });
});

// Add item to cart
app.post('/cart', async (req, res) => {
  const { userId, productId, quantity } = req.body;

  if (!userId || !productId || !quantity) {
    return res.status(400).json({ error: 'userId, productId, and quantity are required' });
  }

  // Fetch existing item to merge quantity
  const existing = await dynamo.get({
    TableName: TABLE,
    Key: { userId, productId }
  }).promise();

  const newQuantity = existing.Item
    ? existing.Item.quantity + quantity
    : quantity;

  const item = { userId, productId, quantity: newQuantity };

  await dynamo.put({ TableName: TABLE, Item: item }).promise();

  res.status(201).json(item);
});
// Update item quantity
app.put('/cart', async (req, res) => {
  const { userId, productId, quantity } = req.body;

  if (!userId || !productId || quantity === undefined) {
    return res.status(400).json({ error: 'userId, productId, and quantity are required' });
  }

  if (quantity <= 0) {
    // delete item if quantity is 0
    await dynamo.delete({
      TableName: TABLE,
      Key: { userId, productId }
    }).promise();

    return res.json({ message: 'Item removed (quantity 0)' });
  }

  const item = { userId, productId, quantity };

  await dynamo.put({
    TableName: TABLE,
    Item: item
  }).promise();

  res.json(item);
});

// Get cart by userId
app.get('/cart/:userId', async (req, res) => {
  const result = await dynamo.query({
    TableName: TABLE,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': req.params.userId }
  }).promise();

  res.json(result.Items);
});

// Delete item from cart
app.delete('/cart/:userId/:productId', async (req, res) => {
  const { userId, productId } = req.params;

  const existing = await dynamo.get({
    TableName: TABLE,
    Key: { userId, productId }
  }).promise();

  if (!existing.Item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  await dynamo.delete({
    TableName: TABLE,
    Key: { userId, productId }
  }).promise();

  res.json({ removed: true });
});

// Lambda handler
module.exports.handler = serverless(app);
