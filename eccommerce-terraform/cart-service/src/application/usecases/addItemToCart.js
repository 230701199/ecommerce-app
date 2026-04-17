const { AppError } = require('../../domain/errors/AppError');
const { CartItem } = require('../../domain/entities/CartItem');

async function addItemToCart({ cartRepository, input, now = new Date() }) {
  const { userId, productId, quantity } = input;

  if (!userId || !productId) {
    throw new AppError('userId and productId are required', { statusCode: 400 });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError('quantity must be a positive integer', { statusCode: 400 });
  }

  const item = new CartItem({ userId, productId, quantity });
  const saved = await cartRepository.addItem(item, { now });
  return saved;
}

module.exports = { addItemToCart };

