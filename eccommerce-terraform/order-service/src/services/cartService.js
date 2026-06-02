const axios = require('axios');

const CART_SERVICE_URL =
  process.env.CART_SERVICE_URL ||
  'https://o8kqf93jnf.execute-api.ap-southeast-1.amazonaws.com';

// Fetch cart
async function fetchCart(userId) {
  const cartRes = await axios.get(
    `${CART_SERVICE_URL}/cart/${userId}`,
    { timeout: 3000 }
  );
  return cartRes.data.data || cartRes.data;
}

// Clear cart
async function clearCart(userId, cartItems) {
  return Promise.all(
    cartItems.map(item =>
      axios.delete(`${CART_SERVICE_URL}/cart/${userId}/${item.productId}`)
    )
  );
}

module.exports = { fetchCart, clearCart };
