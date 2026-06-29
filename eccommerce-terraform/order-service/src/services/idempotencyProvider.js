const { dynamo, ORDER_TABLE } = require('../config/dynamodb');

/**
 * Checks if an idempotency key already exists. If not, creates a new record
 * with a 30-second TTL to prevent duplicate order submissions.
 *
 * @param {string} idempotencyKey - Client-generated UUID for deduplication
 * @param {string} userId - The user making the request
 * @returns {Promise<{exists: boolean, existingData: object|null}>}
 */
async function checkAndSet(idempotencyKey, userId) {
  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + 30;

  const params = {
    TableName: ORDER_TABLE,
    Item: {
      orderId: `IDEMPOTENCY#${idempotencyKey}`,
      userId,
      linkedOrderId: null,
      createdAt: now.toISOString(),
      ttl
    },
    ConditionExpression: 'attribute_not_exists(orderId)'
  };

  try {
    await dynamo.put(params).promise();
    return { exists: false, existingData: null };
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      // Key already exists — fetch the existing record
      const existing = await getExistingOrder(idempotencyKey);
      return { exists: true, existingData: existing };
    }
    throw error;
  }
}

/**
 * Retrieves the idempotency record for a given key.
 * Returns the linked order ID if the record exists.
 *
 * @param {string} idempotencyKey - The idempotency key to look up
 * @returns {Promise<object|null>} The idempotency record or null if not found
 */
async function getExistingOrder(idempotencyKey) {
  const params = {
    TableName: ORDER_TABLE,
    Key: {
      orderId: `IDEMPOTENCY#${idempotencyKey}`
    }
  };

  const result = await dynamo.get(params).promise();
  return result.Item || null;
}

module.exports = { checkAndSet, getExistingOrder };
