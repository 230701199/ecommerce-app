const { Sequelize } = require('sequelize');

const dbName = process.env.DB_NAME || 'ecommerce';
const dbUser = process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD != null ? process.env.DB_PASSWORD : '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = Number(process.env.DB_PORT || 3306);

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: String(process.env.DB_LOGGING || '').toLowerCase() === 'true' ? console.log : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
});

module.exports = { sequelize };

