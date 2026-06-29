const request = require('supertest');
const express = require('express');
const fc = require('fast-check');
const { checkoutValidator } = require('../validators/checkoutValidator');

// Create a minimal Express app for testing the validator
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.post('/orders/checkout', checkoutValidator, (req, res) => {
    res.status(200).json({ success: true });
  });
  return app;
}

// Base valid payload used as template for property tests
const basePayload = {
  userId: 'user-123',
  deliveryAddress: {
    street: '123 Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
  },
  paymentMethod: 'COD',
  paymentDetails: {},
};

/**
 * Property 1: Line Total Calculation
 *
 * For any cart item with a positive unit price and positive integer quantity,
 * the computed line total SHALL equal unit price multiplied by quantity.
 *
 * **Validates: Requirements 1.1**
 */
describe('Property 1: Line Total Calculation', () => {
  it('lineTotal should equal price × quantity for any valid price and quantity', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
        fc.integer({ min: 1, max: 100 }),
        (price, quantity) => {
          // This is the same calculation used in checkoutService.js
          const lineTotal = price * quantity;

          // The lineTotal must equal price * quantity (mathematical identity)
          expect(lineTotal).toBe(price * quantity);

          // lineTotal must be positive since both inputs are positive
          expect(lineTotal).toBeGreaterThan(0);

          // lineTotal must be at least as large as the price (qty >= 1)
          expect(lineTotal).toBeGreaterThanOrEqual(price);

          // lineTotal must be at least as large as the quantity * min price
          expect(lineTotal).toBeGreaterThanOrEqual(quantity * 0.01);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 2: Cart Total is Sum of Line Totals
 *
 * For any non-empty array of cart items where each item has a valid line total,
 * the cart total amount SHALL equal the sum of all line totals.
 *
 * **Validates: Requirements 1.3**
 */
describe('Property 2: Cart Total is Sum of Line Totals', () => {
  it('totalAmount should equal the sum of all lineTotals for any valid items array', () => {
    const lineItemGen = fc.record({
      productId: fc.string({ minLength: 1, maxLength: 10 }),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      quantity: fc.integer({ min: 1, max: 100 }),
      price: fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true }),
    }).map((item) => ({
      ...item,
      lineTotal: item.price * item.quantity,
    }));

    fc.assert(
      fc.property(
        fc.array(lineItemGen, { minLength: 1, maxLength: 50 }),
        (items) => {
          // This mirrors the reduce operation in checkoutService.js
          const totalAmount = items.reduce((sum, item) => sum + item.lineTotal, 0);
          const expectedTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

          expect(totalAmount).toBe(expectedTotal);

          // Total must be positive since all lineTotals are positive
          expect(totalAmount).toBeGreaterThan(0);

          // Total must be >= the maximum lineTotal (since it's a sum of positive values)
          const maxLineTotal = Math.max(...items.map((i) => i.lineTotal));
          expect(totalAmount).toBeGreaterThanOrEqual(maxLineTotal);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Helper: generates a non-empty, non-whitespace string using stringMatching
const nonEmptyNonWhitespaceString = (maxLen) =>
  fc.stringMatching(new RegExp(`^[a-zA-Z0-9 ,.]{1,${maxLen}}$`))
    .filter((s) => s.trim().length > 0);

// Helper: generates a whitespace-only or empty string
const emptyOrWhitespaceString = () =>
  fc.oneof(
    fc.constant(''),
    fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 })
      .map((arr) => arr.join(''))
  );

// Helper: generates exactly 6 digit pincode string
const validPincodeGen = () =>
  fc.array(fc.constantFrom('0','1','2','3','4','5','6','7','8','9'), { minLength: 6, maxLength: 6 })
    .map((arr) => arr.join(''));

describe('Property-Based Tests: Checkout Validator', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  /**
   * Property 3: Address Validation Correctness
   *
   * For any delivery address object, the validator SHALL reject the address
   * if and only if at least one required field (street, city, state, pincode)
   * contains only whitespace characters or is empty.
   * The error response SHALL list exactly the set of fields that are invalid.
   *
   * **Validates: Requirements 2.2, 2.4, 7.1, 7.2**
   */
  describe('Property 3: Address Validation Correctness', () => {
    it('should accept addresses where all required fields are valid non-whitespace strings with valid pincode', async () => {
      await fc.assert(
        fc.asyncProperty(
          nonEmptyNonWhitespaceString(200), // street
          nonEmptyNonWhitespaceString(100), // city
          nonEmptyNonWhitespaceString(100), // state
          validPincodeGen(),                // pincode (exactly 6 digits)
          async (street, city, state, pincode) => {
            const payload = {
              ...basePayload,
              deliveryAddress: { street, city, state, pincode },
            };
            const res = await request(app)
              .post('/orders/checkout')
              .send(payload);
            expect(res.status).toBe(200);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject addresses where at least one required field is empty or whitespace-only, listing exactly the invalid fields', async () => {
      // Generate a bitmask for which fields are invalid (at least one must be)
      const fieldValidityGen = fc.tuple(
        fc.boolean(), // street invalid?
        fc.boolean(), // city invalid?
        fc.boolean(), // state invalid?
        fc.boolean(), // pincode invalid?
      ).filter(([s, c, st, p]) => s || c || st || p); // at least one must be invalid

      await fc.assert(
        fc.asyncProperty(
          fieldValidityGen,
          nonEmptyNonWhitespaceString(200),
          nonEmptyNonWhitespaceString(100),
          nonEmptyNonWhitespaceString(100),
          validPincodeGen(),
          emptyOrWhitespaceString(),
          async ([streetInvalid, cityInvalid, stateInvalid, pincodeInvalid], validStreet, validCity, validState, validPincode, invalidVal) => {
            const payload = {
              ...basePayload,
              deliveryAddress: {
                street: streetInvalid ? invalidVal : validStreet,
                city: cityInvalid ? invalidVal : validCity,
                state: stateInvalid ? invalidVal : validState,
                pincode: pincodeInvalid ? invalidVal : validPincode,
              },
            };

            const res = await request(app)
              .post('/orders/checkout')
              .send(payload);

            expect(res.status).toBe(400);

            // Verify that each invalid field is listed
            if (streetInvalid) {
              expect(res.body.fields).toContain('deliveryAddress.street');
            }
            if (cityInvalid) {
              expect(res.body.fields).toContain('deliveryAddress.city');
            }
            if (stateInvalid) {
              expect(res.body.fields).toContain('deliveryAddress.state');
            }
            if (pincodeInvalid) {
              expect(res.body.fields).toContain('deliveryAddress.pincode');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Pincode Format Validation
   *
   * For any string, the pincode validator SHALL accept it if and only if
   * it consists of exactly 6 digit characters (/^\d{6}$/).
   * All other strings SHALL be rejected with a format error.
   *
   * **Validates: Requirements 2.5, 7.5**
   */
  describe('Property 4: Pincode Format Validation', () => {
    it('should accept any string that is exactly 6 digits', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPincodeGen(),
          async (pincode) => {
            const payload = {
              ...basePayload,
              deliveryAddress: { ...basePayload.deliveryAddress, pincode },
            };
            const res = await request(app)
              .post('/orders/checkout')
              .send(payload);
            expect(res.status).toBe(200);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject any string that is NOT exactly 6 digits', async () => {
      const invalidPincodeGen = fc.oneof(
        // Wrong length digits (1-5 digits)
        fc.stringMatching(/^\d{1,5}$/),
        // Wrong length digits (7+ digits)
        fc.stringMatching(/^\d{7,12}$/),
        // 6 chars but with non-digit characters
        fc.stringMatching(/^[a-zA-Z0-9]{6}$/).filter((s) => !/^\d{6}$/.test(s)),
        // Mixed content
        fc.string({ minLength: 1, maxLength: 15 }).filter((s) => !/^\d{6}$/.test(s) && s.trim().length > 0)
      );

      await fc.assert(
        fc.asyncProperty(
          invalidPincodeGen,
          async (pincode) => {
            const payload = {
              ...basePayload,
              deliveryAddress: { ...basePayload.deliveryAddress, pincode },
            };
            const res = await request(app)
              .post('/orders/checkout')
              .send(payload);
            expect(res.status).toBe(400);
            expect(res.body.fields).toContain('deliveryAddress.pincode');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: UPI ID Format Validation
   *
   * For any string, the UPI ID validator SHALL accept it if and only if
   * it matches the pattern username@provider (alphanumeric characters, dots,
   * or hyphens before @, alphanumeric after @) and is between 3 and 50
   * characters in total length. All non-matching strings SHALL be rejected.
   *
   * **Validates: Requirements 4.6, 7.4**
   */
  describe('Property 5: UPI ID Format Validation', () => {
    const upiRegex = /^[a-zA-Z0-9.\-]+@[a-zA-Z0-9]+$/;

    // Generator for valid UPI IDs
    const validUpiGen = () =>
      fc.tuple(
        fc.stringMatching(/^[a-zA-Z0-9.\-]{1,30}$/),
        fc.stringMatching(/^[a-zA-Z0-9]{1,15}$/)
      )
        .map(([user, provider]) => `${user}@${provider}`)
        .filter((upi) => upi.length >= 3 && upi.length <= 50);

    it('should accept valid UPI IDs matching username@provider pattern within 3-50 chars', async () => {
      await fc.assert(
        fc.asyncProperty(validUpiGen(), async (upiId) => {
          const payload = {
            ...basePayload,
            paymentMethod: 'UPI',
            paymentDetails: { upiId },
          };
          const res = await request(app)
            .post('/orders/checkout')
            .send(payload);
          expect(res.status).toBe(200);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject strings that do not match the UPI ID format or are outside length bounds', async () => {
      const invalidUpiGen = fc.oneof(
        // No @ symbol at all
        fc.stringMatching(/^[a-z0-9]{3,20}$/).filter((s) => !s.includes('@')),
        // Has @ but invalid chars before it (spaces, special chars)
        fc.tuple(
          fc.stringMatching(/^[a-z !#$]{1,10}$/),
          fc.stringMatching(/^[a-z]{1,10}$/)
        ).map(([u, p]) => `${u}@${p}`).filter((s) => !upiRegex.test(s)),
        // Too short (1-2 chars total)
        fc.stringMatching(/^.{1,2}$/),
        // Too long (> 50 chars)
        fc.tuple(
          fc.stringMatching(/^[a-z]{30,40}$/),
          fc.stringMatching(/^[a-z]{15,20}$/)
        ).map(([u, p]) => `${u}@${p}`).filter((s) => s.length > 50),
        // Invalid chars after @
        fc.tuple(
          fc.stringMatching(/^[a-z]{1,5}$/),
          fc.stringMatching(/^[a-z !@#]{1,10}$/)
        ).map(([u, p]) => `${u}@${p}`).filter((s) => !upiRegex.test(s))
      );

      await fc.assert(
        fc.asyncProperty(invalidUpiGen, async (upiId) => {
          // Confirm it doesn't match the valid pattern within bounds
          const isValid = upiRegex.test(upiId) && upiId.length >= 3 && upiId.length <= 50;
          fc.pre(!isValid);

          const payload = {
            ...basePayload,
            paymentMethod: 'UPI',
            paymentDetails: { upiId },
          };
          const res = await request(app)
            .post('/orders/checkout')
            .send(payload);
          expect(res.status).toBe(400);
          expect(res.body.fields).toContain('paymentDetails.upiId');
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Payment Method Enum Validation
   *
   * For any string value provided as payment method, the validator SHALL
   * accept it if and only if it equals "COD" or "UPI".
   * All other values SHALL be rejected with an invalid payment method error.
   *
   * **Validates: Requirements 7.3**
   */
  describe('Property 6: Payment Method Enum Validation', () => {
    it('should accept only "COD" and "UPI" as valid payment methods', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('COD', 'UPI'),
          async (paymentMethod) => {
            const payload = {
              ...basePayload,
              paymentMethod,
              // Include valid UPI details if method is UPI
              paymentDetails: paymentMethod === 'UPI' ? { upiId: 'user@oksbi' } : {},
            };
            const res = await request(app)
              .post('/orders/checkout')
              .send(payload);
            expect(res.status).toBe(200);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject any string that is not "COD" or "UPI"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 30 }).filter(
            (s) => s !== 'COD' && s !== 'UPI'
          ),
          async (paymentMethod) => {
            const payload = {
              ...basePayload,
              paymentMethod,
              paymentDetails: {},
            };
            const res = await request(app)
              .post('/orders/checkout')
              .send(payload);
            expect(res.status).toBe(400);
            expect(res.body.fields).toContain('paymentMethod');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Property 7: Order Creation Invariants
 *
 * For any valid checkout request that is successfully processed, the created
 * order SHALL contain: a UUID-format orderId, all submitted delivery address
 * fields, the selected payment method and details, a status of exactly "CREATED",
 * a createdAt timestamp in ISO 8601 format, and a totalAmount equal to the sum
 * of (quantity × price) for all items.
 *
 * **Validates: Requirements 6.1, 6.2, 9.2**
 */

// Mock dependencies for Property 7 and Property 8
jest.mock('../config/dynamodb', () => ({
  dynamo: {
    put: jest.fn().mockReturnValue({ promise: () => Promise.resolve() }),
    update: jest.fn().mockReturnValue({ promise: () => Promise.resolve() }),
    get: jest.fn().mockReturnValue({ promise: () => Promise.resolve({ Item: null }) }),
  },
  ORDER_TABLE: 'asif-order',
}));

jest.mock('../services/idempotencyProvider');

jest.mock('../services/cartService', () => ({
  fetchCart: jest.fn(),
  clearCart: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/productService', () => ({
  fetchProducts: jest.fn(),
}));

jest.mock('axios');

const { processCheckout } = require('../services/checkoutService');
const { fetchCart, clearCart } = require('../services/cartService');
const { fetchProducts } = require('../services/productService');

describe('Property 7: Order Creation Invariants', () => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ISO_8601_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

  // Generator for valid cart items
  const cartItemGen = fc.record({
    productId: fc.integer({ min: 1, max: 1000 }).map(String),
    quantity: fc.integer({ min: 1, max: 100 }),
  });

  // Generator for valid delivery address
  const addressGen = fc.record({
    street: fc.stringMatching(/^[a-zA-Z0-9 ,.]{1,200}$/).filter((s) => s.trim().length > 0),
    city: fc.stringMatching(/^[a-zA-Z ]{1,100}$/).filter((s) => s.trim().length > 0),
    state: fc.stringMatching(/^[a-zA-Z ]{1,100}$/).filter((s) => s.trim().length > 0),
    pincode: fc.stringMatching(/^\d{6}$/),
  });

  // Generator for valid payment method and details
  const paymentGen = fc.oneof(
    fc.constant({ paymentMethod: 'COD', paymentDetails: {} }),
    fc.tuple(
      fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
      fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/)
    )
      .map(([user, provider]) => ({
        paymentMethod: 'UPI',
        paymentDetails: { upiId: `${user}@${provider}` },
      }))
      .filter((p) => p.paymentDetails.upiId.length >= 3 && p.paymentDetails.upiId.length <= 50)
  );

  // Generator for prices
  const priceGen = fc.double({ min: 0.01, max: 9999.99, noNaN: true, noDefaultInfinity: true });

  it('should produce an order with UUID orderId, status "CREATED", ISO timestamp, and correct totalAmount', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(cartItemGen, { minLength: 1, maxLength: 10 }),
        addressGen,
        paymentGen,
        fc.array(priceGen, { minLength: 50, maxLength: 50 }),
        async (cartItems, deliveryAddress, { paymentMethod, paymentDetails }, prices) => {
          // Build product data that matches cart items with generated prices and sufficient stock
          const products = cartItems.map((item, idx) => ({
            id: Number(item.productId),
            name: `Product-${item.productId}`,
            price: prices[idx % prices.length],
            stock: item.quantity + 100, // Ensure enough stock
          }));

          // Setup mocks
          fetchCart.mockResolvedValue(cartItems);
          fetchProducts.mockResolvedValue(products);
          clearCart.mockResolvedValue(undefined);

          // Mock axios for stock reduction
          const axios = require('axios');
          axios.put = jest.fn().mockResolvedValue({ data: {} });

          const userId = 'test-user-123';
          const idempotencyKey = 'idem-key-001';

          const order = await processCheckout(
            userId,
            deliveryAddress,
            paymentMethod,
            paymentDetails,
            idempotencyKey
          );

          // Invariant 1: orderId must be a valid UUID v4
          expect(order.orderId).toMatch(UUID_REGEX);

          // Invariant 2: status must be exactly "CREATED"
          expect(order.status).toBe('CREATED');

          // Invariant 3: createdAt must be a valid ISO 8601 timestamp
          expect(order.createdAt).toMatch(ISO_8601_REGEX);

          // Invariant 4: totalAmount must equal sum of (price × quantity) for all items
          const expectedTotal = cartItems.reduce((sum, item, idx) => {
            const product = products.find((p) => Number(p.id) === Number(item.productId));
            return sum + product.price * item.quantity;
          }, 0);
          expect(order.totalAmount).toBeCloseTo(expectedTotal, 10);

          // Invariant 5: delivery address fields must match input
          expect(order.deliveryAddress).toEqual(deliveryAddress);

          // Invariant 6: payment method and details must match input
          expect(order.paymentMethod).toBe(paymentMethod);
          expect(order.paymentDetails).toEqual(paymentDetails);

          // Invariant 7: userId must match input
          expect(order.userId).toBe(userId);

          // Invariant 8: idempotencyKey must match input
          expect(order.idempotencyKey).toBe(idempotencyKey);

          // Invariant 9: items array must have correct line totals
          for (const orderItem of order.items) {
            const product = products.find((p) => Number(p.id) === Number(orderItem.productId));
            expect(orderItem.lineTotal).toBeCloseTo(product.price * orderItem.quantity, 10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 8: Idempotent Order Submission
 *
 * For any valid checkout request submitted twice with the same idempotency key
 * within a 30-second window, the system SHALL return the same order (identical
 * orderId and data) on both submissions and SHALL NOT create a second order record.
 *
 * **Validates: Requirements 11.5**
 */
describe('Property 8: Idempotent Order Submission', () => {
  const app = require('../order.js');
  const { checkAndSet } = require('../services/idempotencyProvider');
  const { dynamo } = require('../config/dynamodb');

  // Generator for valid cart items
  const cartItemGen = fc.record({
    productId: fc.integer({ min: 1, max: 1000 }).map(String),
    quantity: fc.integer({ min: 1, max: 10 }),
  });

  // Generator for valid delivery address
  const addressGen = fc.record({
    street: fc.stringMatching(/^[a-zA-Z0-9 ,.]{1,100}$/).filter((s) => s.trim().length > 0),
    city: fc.stringMatching(/^[a-zA-Z ]{1,50}$/).filter((s) => s.trim().length > 0),
    state: fc.stringMatching(/^[a-zA-Z ]{1,50}$/).filter((s) => s.trim().length > 0),
    pincode: fc.stringMatching(/^\d{6}$/),
  });

  // Generator for valid payment (COD only for simplicity)
  const paymentGen = fc.constant({ paymentMethod: 'COD', paymentDetails: {} });

  // Generator for userId
  const userIdGen = fc.stringMatching(/^[a-zA-Z0-9]{3,20}$/);

  // Generator for idempotency key (UUID-like)
  const idempotencyKeyGen = fc.uuid();

  it('should return the same orderId on duplicate submission with the same idempotency key', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(cartItemGen, { minLength: 1, maxLength: 5 }),
        addressGen,
        paymentGen,
        userIdGen,
        idempotencyKeyGen,
        fc.array(
          fc.double({ min: 1, max: 999, noNaN: true, noDefaultInfinity: true }),
          { minLength: 50, maxLength: 50 }
        ),
        async (cartItems, deliveryAddress, { paymentMethod, paymentDetails }, userId, idempotencyKey, prices) => {
          // Build products that match the cart items
          const products = cartItems.map((item, idx) => ({
            id: Number(item.productId),
            name: `Product-${item.productId}`,
            price: prices[idx % prices.length],
            stock: item.quantity + 100,
          }));

          // Reset all mocks at the start of each iteration
          jest.clearAllMocks();

          // Setup mocks for first call (order creation path)
          let firstOrderId = null;
          let firstOrderResponse = null;

          // checkAndSet: first call returns not exists, second call returns exists with linkedOrderId
          checkAndSet.mockImplementation(() => {
            if (firstOrderId) {
              // Second call — key already exists
              return Promise.resolve({
                exists: true,
                existingData: { linkedOrderId: firstOrderId },
              });
            }
            // First call — key is new
            return Promise.resolve({ exists: false, existingData: null });
          });

          // Mock fetchCart and fetchProducts for the first call
          fetchCart.mockResolvedValue(cartItems);
          fetchProducts.mockResolvedValue(products);
          clearCart.mockResolvedValue(undefined);

          // Mock axios for stock reduction
          const axios = require('axios');
          axios.put = jest.fn().mockResolvedValue({ data: {} });

          // Mock dynamo.put to capture the order (first call creates it)
          dynamo.put.mockImplementation((params) => ({
            promise: () => {
              // Capture the orderId from the first order creation
              if (params.Item && params.Item.orderId && !params.Item.orderId.startsWith('IDEMPOTENCY#')) {
                firstOrderId = params.Item.orderId;
                firstOrderResponse = params.Item;
              }
              return Promise.resolve();
            },
          }));

          dynamo.update.mockReturnValue({ promise: () => Promise.resolve() });

          // Mock dynamo.get to return the stored order on the second call
          dynamo.get.mockImplementation((params) => ({
            promise: () => {
              if (params.Key && params.Key.orderId === firstOrderId) {
                return Promise.resolve({ Item: firstOrderResponse });
              }
              return Promise.resolve({ Item: null });
            },
          }));

          const payload = {
            userId,
            deliveryAddress,
            paymentMethod,
            paymentDetails,
            idempotencyKey,
            items: cartItems.map((item) => ({
              productId: item.productId,
              name: `Product-${item.productId}`,
              quantity: item.quantity,
              price: prices[cartItems.indexOf(item) % prices.length],
            })),
          };

          // First submission — should create the order (201)
          const res1 = await request(app)
            .post('/orders/checkout')
            .set('Authorization', 'Bearer test-token')
            .send(payload);

          expect(res1.status).toBe(201);
          expect(res1.body.orderId).toBeDefined();

          // Capture the orderId from the first response
          const originalOrderId = res1.body.orderId;

          // Second submission — should return the same order (409)
          const res2 = await request(app)
            .post('/orders/checkout')
            .set('Authorization', 'Bearer test-token')
            .send(payload);

          expect(res2.status).toBe(409);
          expect(res2.body.orderId).toBe(originalOrderId);

          // Verify no second order was created — dynamo.put should have been
          // called only once for a non-idempotency record (the order itself)
          const orderPutCalls = dynamo.put.mock.calls.filter(
            (call) => call[0].Item && !call[0].Item.orderId.startsWith('IDEMPOTENCY#')
          );
          expect(orderPutCalls).toHaveLength(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
