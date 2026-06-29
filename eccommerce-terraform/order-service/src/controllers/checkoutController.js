const { checkAndSet } = require('../services/idempotencyProvider');
const { processCheckout } = require('../services/checkoutService');
const { dynamo, ORDER_TABLE } = require('../config/dynamodb');

/**
 * POST /orders/checkout handler
 * Processes a checkout request with idempotency support.
 *
 * - Checks idempotency key to prevent duplicate orders
 * - If duplicate with a linked order, returns 409 with the original order
 * - Otherwise delegates to checkoutService.processCheckout
 * - Returns 201 with the created order object
 */
async function checkoutHandler(req, res, next) {
  try {
    const { userId, deliveryAddress, paymentMethod, paymentDetails, idempotencyKey } = req.body;

    // Check idempotency key for duplicate submissions
    const { exists, existingData } = await checkAndSet(idempotencyKey, userId);

    if (exists && existingData && existingData.linkedOrderId) {
      // A previous order was successfully created — fetch and return it
      const result = await dynamo.get({
        TableName: ORDER_TABLE,
        Key: { orderId: existingData.linkedOrderId }
      }).promise();

      const originalOrder = result.Item;
      if (originalOrder) {
        return res.status(409).json(originalOrder);
      }
    }

    // Process the checkout (create order, reduce stock, clear cart)
    const order = await processCheckout(userId, deliveryAddress, paymentMethod, paymentDetails, idempotencyKey);

    return res.status(201).json(order);
  } catch (error) {
    const status = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    return res.status(status).json({ error: message });
  }
}

module.exports = { checkoutHandler };
