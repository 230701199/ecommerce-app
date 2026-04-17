const { AppError } = require('../../domain/errors/AppError');

async function removeCartItem({ cartRepository, userId, productId }) {
  if (!userId) throw new AppError('userId is required', { statusCode: 400 });
  if (!productId) throw new AppError('productId is required', { statusCode: 400 });

  await cartRepository.removeItem({ userId, productId });
  return { removed: true };
}

module.exports = { removeCartItem };

