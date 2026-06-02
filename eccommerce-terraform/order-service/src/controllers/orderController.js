const { dynamo, ORDER_TABLE } = require('../config/dynamodb');
const { fetchCart, clearCart } = require('../services/cartService');
const { fetchProducts } = require('../services/productService');
const {
  mapCartItemsToOrderItems,
  validateStock,
  createOrder,
  reduceProductStock
} = require('../services/orderService');

// Health check
function healthCheck(req, res) {
  res.send('Order service running');
}

// Get all orders
async function getAllOrders(req, res) {
  try {
    const result = await dynamo.scan({ TableName: ORDER_TABLE }).promise();
    res.json(result.Items);
  } catch (err) {
    console.error("Fetch Orders Error:", err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

// Get orders by userId
async function getUserOrders(req, res) {
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
}

// Create order
async function createOrderHandler(req, res) {
  const { userId } = req.body;
  console.log("ORDER USER ID:", req.body.userId);

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  let cartItems;

  // Fetch cart
  try {
    cartItems = await fetchCart(userId);
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
    products = await fetchProducts();
  } catch (err) {
    console.error("Product Fetch Error:", err);
    return res.status(502).json({ error: 'Failed to fetch products' });
  }

  let items;

  // Map items
  try {
    items = mapCartItemsToOrderItems(cartItems, products);
  } catch (err) {
    console.error("Mapping Error:", err);
    return res.status(400).json({ error: err.message });
  }

  // Validate stock
  try {
    validateStock(items, products);
  } catch (err) {
    console.error("Stock Validation Error:", err);
    return res.status(400).json({ error: err.message });
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0
  );

  // Save order
  try {
    const order = await createOrder(userId, items, totalAmount);

    // 🔥 REDUCE STOCK AFTER ORDER
    try {
      await reduceProductStock(items);
    } catch (err) {
      console.error("Stock update failed:", err);
      return res.status(500).json({ error: "Stock update failed" });
    }

    // CLEAR CART
    try {
      await clearCart(userId, cartItems);
    } catch (err) {
      console.error("Cart clear failed:", err);
    }

    res.status(201).json(order);
  } catch (err) {
    console.error("DynamoDB ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  healthCheck,
  getAllOrders,
  getUserOrders,
  createOrderHandler
};
