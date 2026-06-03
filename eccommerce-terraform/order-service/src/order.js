const express = require('express');
const {
  healthCheck,
  getAllOrders,
  getUserOrders,
  createOrderHandler,
  getAdminOrders,
  updateOrderStatus
} = require('./controllers/orderController');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.get('/', healthCheck);

app.get('/orders', getAllOrders);

app.get('/orders/:userId', getUserOrders);

app.post('/orders', createOrderHandler);

app.get('/admin/orders', getAdminOrders);

app.put('/admin/orders/:orderId/status', updateOrderStatus);

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