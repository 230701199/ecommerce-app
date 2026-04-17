const { sequelize } = require('../config/database');
const { Product } = require('./Product');

async function initDb() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    return true;
  } catch (err) {
    console.warn(
      '[product-service] Database connection unavailable. Starting server without DB. ' +
        `(${err && err.message ? err.message : 'unknown error'})`
    );
    return false;
  }
}

module.exports = { sequelize, Product, initDb };

