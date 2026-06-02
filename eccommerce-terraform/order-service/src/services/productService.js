const axios = require('axios');

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL ||
  'https://o8kqf93jnf.execute-api.ap-southeast-1.amazonaws.com';

// Fetch products
async function fetchProducts() {
  const productRes = await axios.get(
    `${PRODUCT_SERVICE_URL}/products`,
    { timeout: 3000 }
  );
  return productRes.data.data || productRes.data;
}

module.exports = { fetchProducts };
