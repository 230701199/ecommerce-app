const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { dynamo, ORDER_TABLE } = require('../config/dynamodb');
const { fetchCart, clearCart } = require('./cartService');
const { fetchProducts } = require('./productService');
const { reduceProductStock } = require('./orderService');
const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL ||
  'https://o8kqf93jnf.execute-api.ap-southeast-1.amazonaws.com';

/**
 * Processes a checkout request end-to-end:
 * 1. Fetches cart items from Cart Service
 * 2. Fetches products from Product Service (validates stock, gets prices)
 * 3. Calculates line totals and cart total
 * 4. Creates order record in DynamoDB
 * 5. Reduces stock via Product Service
 * 6. Clears cart (best-effort)
 *
 * @param {string} userId
 * @param {object} deliveryAddress
 * @param {string} paymentMethod
 * @param {object} paymentDetails
 * @param {string} idempotencyKey
 * @returns {Promise<object>} The created order object
 */
async function processCheckout(userId, deliveryAddress, paymentMethod, paymentDetails, idempotencyKey) {
  // 1. Fetch cart items from Cart Service
  let cartItems;
  try {
    cartItems = await fetchCart(userId);
  } catch (error) {
    const err = new Error('Failed to fetch cart');
    err.statusCode = 502;
    throw err;
  }

  // Validate cart is not empty
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    const err = new Error('Cart is empty');
    err.statusCode = 400;
    throw err;
  }

  // 2. Fetch products from Product Service to validate stock and get current prices
  let products;
  try {
    products = await fetchProducts();
  } catch (error) {
    const err = new Error('Failed to fetch product data');
    err.statusCode = 502;
    throw err;
  }

  // 3. Validate stock availability and build order items with line totals
  const orderItems = [];
  for (const cartItem of cartItems) {
    const product = products.find(
      (p) => Number(p.id) === Number(cartItem.productId)
    );

    if (!product) {
      const err = new Error(`Product not found: ${cartItem.productId}`);
      err.statusCode = 400;
      throw err;
    }

    if (product.stock < cartItem.quantity) {
      const err = new Error(
        `Only ${product.stock} quantity available for ${product.name}`
      );
      err.statusCode = 400;
      throw err;
    }

    const lineTotal = product.price * cartItem.quantity;
    orderItems.push({
      productId: cartItem.productId,
      name: product.name,
      quantity: cartItem.quantity,
      price: product.price,
      lineTotal
    });
  }

  // 4. Calculate cart total (sum of line totals)
  const totalAmount = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

  // 5. Generate UUID orderId and create order record in DynamoDB
  const orderId = uuidv4();
  const createdAt = new Date().toISOString();

  const order = {
    orderId,
    userId,
    items: orderItems,
    deliveryAddress,
    paymentMethod,
    paymentDetails: paymentDetails || {},
    totalAmount,
    status: 'CREATED',
    createdAt,
    idempotencyKey
  };

  await dynamo.put({
    TableName: ORDER_TABLE,
    Item: order
  }).promise();

  // 6. Update idempotency record with linkedOrderId
  try {
    await dynamo.update({
      TableName: ORDER_TABLE,
      Key: { orderId: `IDEMPOTENCY#${idempotencyKey}` },
      UpdateExpression: 'SET linkedOrderId = :orderId',
      ExpressionAttributeValues: { ':orderId': orderId }
    }).promise();
  } catch (error) {
    console.error('Failed to update idempotency record:', error.message);
  }

  // 7. Reduce stock directly in DynamoDB using existing order service logic
  try {
    await reduceProductStock(orderItems);
} catch (error) {
    const err = new Error('Stock update failed');
    err.statusCode = 500;
    throw err;
}

  // 8. Clear cart (best-effort — log failure without rollback)
  try {
    await clearCart(userId, cartItems);
  } catch (error) {
    console.error('Failed to clear cart after order creation:', error.message);
  }

  return order;
}

/**
 * Reduces stock for each ordered item by calling the Product Service PUT endpoint.
 * Calculates new stock as (current stock - ordered quantity) and sends update.
 *
 * @param {Array} orderItems - Items with productId and quantity
 * @param {Array} products - Full product data with current stock levels
 */


module.exports = { processCheckout };
