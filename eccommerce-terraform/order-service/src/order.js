const express = require('express');
const {
  healthCheck,
  getAllOrders,
  getUserOrders,
  createOrderHandler,
  getAdminOrders,
  updateOrderStatus
} = require('./controllers/orderController');
const { checkoutHandler } = require('./controllers/checkoutController');
const { checkoutValidator } = require('./validators/checkoutValidator');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

/**
 * JWT auth middleware.
 * In production, JWT validation is handled by API Gateway's JWT authorizer.
 * This middleware simulates that behaviour by requiring an Authorization header.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/', healthCheck);

app.get('/orders', getAllOrders);

app.get('/orders/:userId', getUserOrders);

app.post('/orders', createOrderHandler);

app.get('/admin/orders', getAdminOrders);

app.put('/admin/orders/:orderId/status', updateOrderStatus);

app.post('/orders/checkout', authMiddleware, ...checkoutValidator, checkoutHandler);

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  const status = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

// Lambda fix
if (!process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.JEST_WORKER_ID) {
  app.listen(PORT, () => {
    console.log(`Order service listening on port ${PORT}`);
  });
}

module.exports = app;