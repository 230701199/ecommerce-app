const express = require('express');
const { body, param } = require('express-validator');
const { addProduct, getAllProducts, getProductById, deleteProduct, updateProduct } = require('../controllers/productController');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.post(
  '/products',
  [
    body('name').isString().notEmpty().withMessage('name is required'),
    body('description').optional().isString(),
    body('price').isFloat({ gt: 0 }).withMessage('price must be a positive number'),
    body('stock').isInt({ min: 0 }).withMessage('stock must be >= 0'),
    body('category').isString().notEmpty().withMessage('category is required')
  ],
  validate,
  addProduct
);

router.get('/products', getAllProducts);

router.get(
  '/products/:id',
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validate,
  getProductById
);

router.delete(
  '/products/:id',
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validate,
  deleteProduct
);

router.put(
  '/products/:id',
  [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')],
  validate,
  updateProduct
);

module.exports = { productRoutes: router };

