const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define(
  'Product',
  {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    category: { type: DataTypes.STRING(120), allowNull: false }
  },
  { tableName: 'products', timestamps: true }
);

module.exports = { Product };

