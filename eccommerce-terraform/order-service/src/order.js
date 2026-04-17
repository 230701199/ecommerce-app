const express = require('express');
const axios = require('axios');
const AWS = require('aws-sdk');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

// DynamoDB config
const dynamo = new AWS.DynamoDB.DocumentClient({
  region: 'ap-southeast-1'
});

const ORDER_TABLE = 'asif-order';

app.get('/', (req, res) => {
  res.send('Order service running');
});

// Get all orders
app.get('/orders', async (req, res) => {
  try {
    const result = await dynamo.scan({ TableName: ORDER_TABLE }).promise();
    res.json(result.Items);
  } catch (err) {
    console.error("Fetch Orders Error:", err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get orders by userId
app.get('/orders/:userId', async (req, res) => {
  try {
    const result = await dynamo.scan({ TableName: ORDER_TABLE }).promise();
    const filtered = result.Items.filter(
      (o) => o.userId === req.params.userId
    );
    res.json(filtered);
  } catch (err) {
    console.error("Fetch User Orders Error:", err);
    res.status(500).json({ error: 'Failed to fetch user orders' });
  }
});

// API URLs
const CART_SERVICE_URL =
  process.env.CART_SERVICE_URL ||
  'https://hmc6vv0vv2.execute-api.ap-southeast-1.amazonaws.com';

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL ||
  'https://hmc6vv0vv2.execute-api.ap-southeast-1.amazonaws.com';

// Create order
app.post('/orders', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  let cartItems;

  // Fetch cart
  try {
    const cartRes = await axios.get(
      `${CART_SERVICE_URL}/cart/${userId}`,
      { timeout: 3000 }
    );
    cartItems = cartRes.data.data || cartRes.data;
  } catch (err) {
    console.error("Cart Fetch Error:", err);
    return res.status(502).json({ error: 'Failed to fetch cart' });
  }

  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  let products;

  // Fetch products
  try {
    const productRes = await axios.get(
      `${PRODUCT_SERVICE_URL}/products`,
      { timeout: 3000 }
    );
    products = productRes.data.data || productRes.data;
  } catch (err) {
    console.error("Product Fetch Error:", err);
    return res.status(502).json({ error: 'Failed to fetch products' });
  }

  let items;

  // Map items
  try {
    items = cartItems.map((item) => {
      const product = products.find(
        (p) => Number(p.id) === Number(item.productId)
      );

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price
      };
    });
  } catch (err) {
    console.error("Mapping Error:", err);
    return res.status(400).json({ error: err.message });
  }

  // 🔥 CHECK STOCK BEFORE ORDER (UPDATED MESSAGE)
  for (const item of items) {
    const product = products.find(
      (p) => Number(p.id) === Number(item.productId)
    );

    if (!product) {
      return res.status(400).json({ error: "Product not found" });
    }

    if (product.stock < item.quantity) {
      return res.status(400).json({
        error: `Only ${product.stock} quantity available for ${product.name}. Please reduce quantity.`
      });
    }
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  const order = {
    orderId: Date.now().toString(),
    userId,
    items,
    totalAmount,
    status: 'CREATED',
    createdAt: new Date().toISOString()
  };

  // Save order
  try {
    await dynamo.put({
      TableName: ORDER_TABLE,
      Item: order
    }).promise();
  } catch (err) {
    console.error("DynamoDB ERROR:", err);
    return res.status(500).json({ error: err.message });
  }

  // 🔥 REDUCE STOCK AFTER ORDER
  try {
    await Promise.all(
      items.map(item =>
        dynamo.update({
          TableName: "asif-products",
          Key: { id: Number(item.productId) },
          UpdateExpression: "SET stock = stock - :q",
          ConditionExpression: "stock >= :q",
          ExpressionAttributeValues: {
            ":q": item.quantity
          }
        }).promise()
      )
    );
  } catch (err) {
    console.error("Stock update failed:", err);
    return res.status(500).json({ error: "Stock update failed" });
  }

  // CLEAR CART
  try {
    await Promise.all(
      cartItems.map(item =>
        axios.delete(`${CART_SERVICE_URL}/cart/${userId}/${item.productId}`)
      )
    );
  } catch (err) {
    console.error("Cart clear failed:", err);
  }

  res.status(201).json(order);
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: 'Internal server error' });
});

// Lambda fix
if (!process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.JEST_WORKER_ID) {
  app.listen(PORT, () => {
    console.log(`Order service listening on port ${PORT}`);
  });
}

module.exports = app;