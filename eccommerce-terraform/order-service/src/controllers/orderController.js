const { dynamo, ORDER_TABLE } = require('../config/dynamodb');
const { fetchCart, clearCart } = require('../services/cartService');
const { fetchProducts } = require('../services/productService');
const {
  mapCartItemsToOrderItems,
  validateStock,
  createOrder,
  reduceProductStock
} = require('../services/orderService');
const { getUserEmail } = require('../services/cognitoService');
const { recordOrderPlaced } = require('../business-metrics');

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
    const items = result.Items || [];

    // Filter by userId and exclude IDEMPOTENCY# prefixed records
    const filtered = items.filter(
      (o) => o.userId === req.params.userId && !o.orderId.startsWith('IDEMPOTENCY#')
    );

    // Return orders with all enhanced fields
    const orders = filtered.map((order) => ({
      orderId: order.orderId,
      userId: order.userId,
      items: order.items || [],
      deliveryAddress: order.deliveryAddress || null,
      paymentMethod: order.paymentMethod || null,
      paymentDetails: order.paymentDetails || {},
      totalAmount: order.totalAmount || 0,
      status: order.status || 'CREATED',
      createdAt: order.createdAt || null
    }));

    res.json(orders);
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

    // Record custom business metric
    try {
      await recordOrderPlaced({
        orderId: order.orderId,
        userId: order.userId,
        totalAmount: order.totalAmount
      });
    } catch (metricErr) {
      console.error("Failed to record OrderPlaced metric:", metricErr);
    }

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

// Cognito Admin Authorization check
function requireAdmin(req) {
  if (req.headers && req.headers.role === 'admin') {
    return;
  }

  const claims =
    req.apiGateway?.event?.requestContext?.authorizer?.jwt?.claims ||
    req.apiGateway?.event?.requestContext?.authorizer?.claims;

  console.log("CLAIMS:", JSON.stringify(claims));

  const groups = claims?.["cognito:groups"] || "";

  const groupList = Array.isArray(groups)
    ? groups
    : String(groups)
        .replace(/[\[\]]/g, "")
        .split(",")
        .map(g => g.trim());

  console.log("GROUPS:", groupList);

  if (!groupList.includes("admin")) {
    const err = new Error("Admin access required");
    err.statusCode = 403;
    throw err;
  }
}

// Get all orders (Admin only)
async function getAdminOrders(req, res, next) {
  try {
    requireAdmin(req);

    const result = await dynamo.scan({ TableName: ORDER_TABLE }).promise();
    const orders = result.Items || [];

    const mappedOrders = await Promise.all(
      orders.map(async (order) => {
        const email = await getUserEmail(order.userId);
        const itemCount = order.items
          ? order.items.reduce((acc, item) => acc + (item.quantity || 0), 0)
          : 0;

        return {
          orderId: order.orderId,
          email,
          status: order.status || 'PENDING',
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
          itemCount
        };
      })
    );

    res.json(mappedOrders);
  } catch (err) {
    next(err);
  }
}

// Update order status (Admin only)
async function updateOrderStatus(req, res, next) {
  try {
    requireAdmin(req);

    const { orderId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

    if (!status || !allowedStatuses.includes(status)) {
      const err = new Error(`Invalid status. Allowed values: ${allowedStatuses.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const getResult = await dynamo.get({
      TableName: ORDER_TABLE,
      Key: { orderId }
    }).promise();

    if (!getResult.Item) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    await dynamo.update({
      TableName: ORDER_TABLE,
      Key: { orderId },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': status
      }
    }).promise();

    res.json({ message: 'Order status updated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  healthCheck,
  getAllOrders,
  getUserOrders,
  createOrderHandler,
  getAdminOrders,
  updateOrderStatus
};
