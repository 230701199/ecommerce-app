const { body, validationResult } = require('express-validator');

/**
 * Express-validator middleware chain for POST /orders/checkout
 * Validates: userId, deliveryAddress, paymentMethod, upiId (conditional), items array
 */
const checkoutValidationRules = [
  // userId: required, non-empty
  body('userId')
    .exists({ checkFalsy: true })
    .withMessage('userId is required')
    .isString()
    .withMessage('userId must be a string')
    .trim()
    .notEmpty()
    .withMessage('userId must not be empty'),

  // deliveryAddress.street: required, 1-200 chars
  body('deliveryAddress.street')
    .exists({ checkFalsy: true })
    .withMessage('street is required')
    .isString()
    .withMessage('street must be a string')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('street must be between 1 and 200 characters'),

  // deliveryAddress.city: required, 1-100 chars
  body('deliveryAddress.city')
    .exists({ checkFalsy: true })
    .withMessage('city is required')
    .isString()
    .withMessage('city must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('city must be between 1 and 100 characters'),

  // deliveryAddress.state: required, 1-100 chars
  body('deliveryAddress.state')
    .exists({ checkFalsy: true })
    .withMessage('state is required')
    .isString()
    .withMessage('state must be a string')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('state must be between 1 and 100 characters'),

  // deliveryAddress.pincode: required, exactly 6 digits
  body('deliveryAddress.pincode')
    .exists({ checkFalsy: true })
    .withMessage('pincode is required')
    .isString()
    .withMessage('pincode must be a string')
    .matches(/^\d{6}$/)
    .withMessage('pincode must be exactly 6 digits'),

  // deliveryAddress.landmark: optional, 0-200 chars
  body('deliveryAddress.landmark')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('landmark must be a string')
    .isLength({ max: 200 })
    .withMessage('landmark must be at most 200 characters'),

  // paymentMethod: required, must be COD or UPI
  body('paymentMethod')
    .exists({ checkFalsy: true })
    .withMessage('paymentMethod is required')
    .isIn(['COD', 'UPI'])
    .withMessage('paymentMethod must be COD or UPI'),

  // paymentDetails.upiId: required when paymentMethod is UPI, regex + 3-50 chars
  body('paymentDetails.upiId')
    .if(body('paymentMethod').equals('UPI'))
    .exists({ checkFalsy: true })
    .withMessage('upiId is required when payment method is UPI')
    .isString()
    .withMessage('upiId must be a string')
    .isLength({ min: 3, max: 50 })
    .withMessage('upiId must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9.\-]+@[a-zA-Z0-9]+$/)
    .withMessage('upiId must match format username@provider'),

  // idempotencyKey: optional, string (used for duplicate submission detection)
  body('idempotencyKey')
    .optional()
    .isString()
    .withMessage('idempotencyKey must be a string'),
];

/**
 * Middleware to handle validation results.
 * Returns HTTP 400 with list of all invalid field names on failure.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const invalidFields = [...new Set(errors.array().map((err) => err.path))];
    return res.status(400).json({
      error: 'Validation failed',
      fields: invalidFields,
    });
  }
  next();
}

// Export the complete middleware array (validation rules + result handler)
const checkoutValidator = [...checkoutValidationRules, handleValidationErrors];

module.exports = { checkoutValidator, checkoutValidationRules, handleValidationErrors };
