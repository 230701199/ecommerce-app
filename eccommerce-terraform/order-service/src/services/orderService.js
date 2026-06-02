const { dynamo, ORDER_TABLE } = require('../config/dynamodb');

// Map cart items to order items with pricing
function mapCartItemsToOrderItems(cartItems, products) {
  return cartItems.map((item) => {
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
}

// Validate stock availability
function validateStock(items, products) {
  // 🔥 CHECK STOCK BEFORE ORDER (UPDATED MESSAGE)
  for (const item of items) {
    const product = products.find(
      (p) => Number(p.id) === Number(item.productId)
    );

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.stock < item.quantity) {
      throw new Error(
        `Only ${product.stock} quantity available for ${product.name}. Please reduce quantity.`
      );
    }
  }
}

// Create and save order
async function createOrder(userId, items, totalAmount) {
  const order = {
    orderId: Date.now().toString(),
    userId,
    items,
    totalAmount,
    status: 'CREATED',
    createdAt: new Date().toISOString()
  };

  await dynamo.put({
    TableName: ORDER_TABLE,
    Item: order
  }).promise();

  return order;
}

// Reduce product stock after order
async function reduceProductStock(items) {
  // 🔥 REDUCE STOCK AFTER ORDER
  return Promise.all(
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
}

module.exports = {
  mapCartItemsToOrderItems,
  validateStock,
  createOrder,
  reduceProductStock
};
