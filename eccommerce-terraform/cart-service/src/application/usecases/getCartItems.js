const { AppError } = require('../../domain/errors/AppError');

async function getCartItems({ cartRepository, userId }) {
  if (!userId) throw new AppError('userId is required', { statusCode: 400 });
  return await cartRepository.getItemsByUserId(userId);
}

module.exports = { getCartItems };

