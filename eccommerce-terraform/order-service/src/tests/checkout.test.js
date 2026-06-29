// ✅ MOCK FIRST — must be before any require()
jest.mock('aws-sdk');
jest.mock('axios');
jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn(() => ({ send: jest.fn() })),
  PutMetricDataCommand: jest.fn(),
}));

const AWS = require('aws-sdk');
const axios = require('axios');

// ✅ DynamoDB mocks
const mockPut = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue({})
});
const mockUpdate = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue({})
});
const mockGet = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue({ Item: null })
});
const mockScan = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue({ Items: [] })
});

AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
  put: mockPut,
  update: mockUpdate,
  get: mockGet,
  scan: mockScan
}));

// ✅ IMPORT AFTER MOCK
const app = require('../order.js');
const request = require('supertest');

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ISO 8601 regex pattern
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

// Valid checkout payload
const validPayload = {
  userId: 'user-123',
  idempotencyKey: 'idem-key-001',
  deliveryAddress: {
    street: '123 Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001'
  },
  paymentMethod: 'COD',
  paymentDetails: {}
};

// Helper: mock services for a successful checkout flow
function setupSuccessfulCheckout() {
  // cartService.fetchCart — returns cart items
  axios.get.mockImplementation((url) => {
    if (url.includes('/cart/')) {
      return Promise.resolve({
        data: [{ productId: '1', quantity: 2 }]
      });
    }
    // productService.fetchProducts — returns products
    if (url.includes('/products')) {
      return Promise.resolve({
        data: [{ id: 1, name: 'Widget', price: 100, stock: 10 }]
      });
    }
    return Promise.reject(new Error('Unexpected GET'));
  });

  // Stock reduction PUT
  axios.put.mockResolvedValue({ data: { success: true } });

  // Cart clear DELETE
  axios.delete.mockResolvedValue({ data: {} });

  // Idempotency checkAndSet — first time, no duplicate
  mockPut.mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
}

describe('POST /orders/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mock behaviors
    mockPut.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
    mockUpdate.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
    mockGet.mockReturnValue({ promise: jest.fn().mockResolvedValue({ Item: null }) });
  });

  // ─── Test 1: Valid checkout creates order with correct structure ───
  describe('Valid checkout creates order with correct structure', () => {
    test('returns 201 with orderId, items, deliveryAddress, paymentMethod, totalAmount, status, createdAt', async () => {
      setupSuccessfulCheckout();

      const res = await request(app)
        .post('/orders/checkout')
        .set('Authorization', 'Bearer test-token')
        .send(validPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('orderId');
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('deliveryAddress');
      expect(res.body).toHaveProperty('paymentMethod', 'COD');
      expect(res.body).toHaveProperty('totalAmount', 200); // 100 * 2
      expect(res.body).toHaveProperty('status', 'CREATED');
      expect(res.body).toHaveProperty('createdAt');
    });
  });

  // ─── Test 2: UUID format orderId is generated ───
  describe('UUID format orderId', () => {
    test('orderId matches UUID v4 format', async () => {
      setupSuccessfulCheckout();

      const res = await request(app)
        .post('/orders/checkout')
        .set('Authorization', 'Bearer test-token')
        .send(validPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.orderId).toMatch(UUID_REGEX);
    });
  });

  // ─── Test 3: createdAt is ISO 8601 format ───
  describe('ISO 8601 timestamp', () => {
    test('createdAt matches ISO 8601 format', async () => {
      setupSuccessfulCheckout();

      const res = await request(app)
        .post('/orders/checkout')
        .set('Authorization', 'Bearer test-token')
        .send(validPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body.createdAt).toMatch(ISO_DATE_REGEX);
    });
  });

  // ─── Test 4: Empty cart returns 400 ───
  describe('Empty cart', () => {
    test('returns 400 with "Cart is empty" when cart has no items', async () => {
      // fetchCart returns empty array
      axios.get.mockImplementation((url) => {
        if (url.includes('/cart/')) {
          return Promise.resolve({ data: [] });
        }
        return Promise.reject(new Error('Unexpected GET'));
      });

      const res = await request(app)
        .post('/orders/checkout')
        .set('Authorization', 'Bearer test-token')
        .send(validPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Cart is empty');
    });
  });

  // ─── Test 5: Insufficient stock returns 400 with product name + available qty ───
  describe('Insufficient stock', () => {
    test('returns 400 with product name and available quantity', async () => {
      axios.get.mockImplementation((url) => {
        if (url.includes('/cart/')) {
          return Promise.resolve({
            data: [{ productId: '1', quantity: 20 }]
          });
        }
        if (url.includes('/products')) {
          return Promise.resolve({
            data: [{ id: 1, name: 'ProductName', price: 50, stock: 5 }]
          });
        }
        return Promise.reject(new Error('Unexpected GET'));
      });

      const res = await request(app)
        .post('/orders/checkout')
        .set('Authorization', 'Bearer test-token')
        .send(validPayload);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Only 5 quantity available for ProductName');
    });
  });

  // ─── Test 6: Cart Service unreachable returns 502 ───
  describe('Cart Service unreachable', () => {
    test('returns 502 when fetchCart throws network error', async () => {
      axios.get.mockImplementation((url) => {
        if (url.includes('/cart/')) {
          return Promise.reject(new Error('ECONNREFUSED'));
        }
        return Promise.reject(new Error('Unexpected GET'));
      });

      const res = await request(app)
        .post('/orders/checkout')
        .set('Authorization', 'Bearer test-token')
        .send(validPayload);

      expect(res.statusCode).toBe(502);
      expect(res.body.error).toContain('Failed to fetch cart');
    });
  });

  // ─── Test 7: Stock reduction failure returns 500 ───
  describe('Stock reduction failure', () => {
    test('returns 500 with "Stock update failed" when product service PUT fails', async () => {
      axios.get.mockImplementation((url) => {
        if (url.includes('/cart/')) {
          return Promise.resolve({
            data: [{ productId: '1', quantity: 2 }]
          });
        }
        if (url.includes('/products')) {
          return Promise.resolve({
            data: [{ id: 1, name: 'Widget', price: 100, stock: 10 }]
          });
        }
        return Promise.reject(new Error('Unexpected GET'));
      });

      // Stock reduction PUT fails
      axios.put.mockRejectedValue(new Error('Service unavailable'));

      // Cart clear
      axios.delete.mockResolvedValue({ data: {} });

      const res = await request(app)
        .post('/orders/checkout')
        .set('Authorization', 'Bearer test-token')
        .send(validPayload);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toContain('Stock update failed');
    });
  });

  // ─── Test 8: Cart clear failure does NOT rollback order ───
  describe('Cart clear failure does not rollback', () => {
    test('returns 201 with order even if clearCart fails', async () => {
      axios.get.mockImplementation((url) => {
        if (url.includes('/cart/')) {
          return Promise.resolve({
            data: [{ productId: '1', quantity: 2 }]
          });
        }
        if (url.includes('/products')) {
          return Promise.resolve({
            data: [{ id: 1, name: 'Widget', price: 100, stock: 10 }]
          });
        }
        return Promise.reject(new Error('Unexpected GET'));
      });

      // Stock reduction succeeds
      axios.put.mockResolvedValue({ data: { success: true } });

      // Cart clear DELETE fails
      axios.delete.mockRejectedValue(new Error('Cart service down'));

      const res = await request(app)
        .post('/orders/checkout')
        .set('Authorization', 'Bearer test-token')
        .send(validPayload);

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('orderId');
      expect(res.body.status).toBe('CREATED');
    });
  });

  // ─── Test 9: Duplicate idempotency key returns 409 with original order ───
  describe('Duplicate idempotency key', () => {
    test('returns 409 with original order when idempotency key already used', async () => {
      const originalOrder = {
        orderId: 'original-order-id',
        userId: 'user-123',
        status: 'CREATED',
        totalAmount: 200,
        items: [{ productId: '1', name: 'Widget', quantity: 2, price: 100 }]
      };

      // Idempotency checkAndSet — conditional put fails (key exists)
      mockPut.mockReturnValueOnce({
        promise: jest.fn().mockRejectedValue(
          Object.assign(new Error('ConditionalCheckFailedException'), {
            code: 'ConditionalCheckFailedException'
          })
        )
      });

      // getExistingOrder — returns existing idempotency record with linkedOrderId
      mockGet.mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: { orderId: 'IDEMPOTENCY#idem-key-001', linkedOrderId: 'original-order-id', userId: 'user-123' }
        })
      })
      // Fetching the original order by linkedOrderId
      .mockReturnValueOnce({
        promise: jest.fn().mockResolvedValue({
          Item: originalOrder
        })
      });

      const res = await request(app)
        .post('/orders/checkout')
        .set('Authorization', 'Bearer test-token')
        .send(validPayload);

      expect(res.statusCode).toBe(409);
      expect(res.body.orderId).toBe('original-order-id');
    });
  });
});

// ✅ Cleanup
afterAll(() => {
  jest.clearAllMocks();
});
