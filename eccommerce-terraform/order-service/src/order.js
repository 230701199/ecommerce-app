const express = require('express');
const {
  healthCheck,
  getAllOrders,
  getUserOrders,
  createOrderHandler
} = require('./controllers/orderController');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

app.get('/', healthCheck);

app.get('/orders', getAllOrders);

app.get('/orders/:userId', getUserOrders);

app.post('/orders', createOrderHandler);

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