// ─── Integration Tests: Full HTTP request/response flow ───
// Tests the complete middleware chain: Auth → Validator → Controller → Service → Response

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

// ✅ IMPORT AFTER MOCKS
const app = require('../order.js');
const request = require('supertest');

// UUID v4 regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ISO 8601 regex
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

/**
 * Sets up mocks for a successful checkout flow end-to-end.
 */
function setupSuccessfulCheckout() {
  // Cart Service: fetchCart returns items
  // Product Service: fetchProducts returns products with sufficient stock
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

  // Stock reduction PUT succeeds
  axios.put.mockResolvedValue({ data: { success: true } });

  // Cart clear DELETE succeeds
  axios.delete.mockResolvedValue({ data: {} });

  // DynamoDB put succeeds (idempotency + order creation)
  mockPut.mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });

  // DynamoDB update succeeds (idempotency record update)
  mockUpdate.mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
}

describe('Integration: POST /orders/checkout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPut.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
    mockUpdate.mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
    mockGet.mockReturnValue({ promise: jest.fn().mockResolvedValue({ Item: null }) });
    mockScan.mockReturnValue({ promise: jest.fn().mockResolvedValue({ Items: [] }) });
  });

  // ─── 1. Happy path: 201 with complete order object ───
  test('returns 201 with complete order object on successful checkout', async () => {
    setupSuccessfulCheckout();

    const res = await request(app)
      .post('/orders/checkout')
      .set('Authorization', 'Bearer test-token')
      .send(validPayload);

    expect(res.statusCode).toBe(201);
    expect(res.body.orderId).toMatch(UUID_REGEX);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.deliveryAddress).toEqual(validPayload.deliveryAddress);
    expect(res.body.paymentMethod).toBe('COD');
    expect(res.body.paymentDetails).toEqual({});
    expect(res.body.totalAmount).toBe(200); // 100 * 2
    expect(res.body.status).toBe('CREATED');
    expect(res.body.createdAt).toMatch(ISO_DATE_REGEX);
  });

  // ─── 2. No JWT returns 401 ───
  test('returns 401 Unauthorized when no Authorization header is provided', async () => {
    const res = await request(app)
      .post('/orders/checkout')
      .send(validPayload);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  // ─── 3. Empty cart returns 400 ───
  test('returns 400 with "Cart is empty" when cart has no items', async () => {
    axios.get.mockImplementation((url) => {
      if (url.includes('/cart/')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/products')) {
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

  // ─── 4. Insufficient stock returns 400 with product name and available quantity ───
  test('returns 400 with product name and available quantity when stock is insufficient', async () => {
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
    expect(res.body.error).toContain('ProductName');
    expect(res.body.error).toContain('5');
    expect(res.body.error).toMatch(/Only 5 quantity available for ProductName/);
  });

  // ─── 5. Cart Service unreachable returns 502 ───
  test('returns 502 when Cart Service is unreachable', async () => {
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

  // ─── 6. Stock reduction fails returns 500 ───
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

    // Cart clear succeeds
    axios.delete.mockResolvedValue({ data: {} });

    const res = await request(app)
      .post('/orders/checkout')
      .set('Authorization', 'Bearer test-token')
      .send(validPayload);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Stock update failed');
  });

  // ─── 7. Duplicate submission within 30s returns 409 with original order ───
  test('returns 409 with original order on duplicate idempotency key', async () => {
    const originalOrder = {
      orderId: 'original-order-id',
      userId: 'user-123',
      items: [{ productId: '1', name: 'Widget', quantity: 2, price: 100, lineTotal: 200 }],
      deliveryAddress: validPayload.deliveryAddress,
      paymentMethod: 'COD',
      paymentDetails: {},
      totalAmount: 200,
      status: 'CREATED',
      createdAt: '2024-01-01T00:00:00.000Z'
    };

    // Idempotency checkAndSet — conditional put fails (key already exists)
    mockPut.mockReturnValueOnce({
      promise: jest.fn().mockRejectedValue(
        Object.assign(new Error('ConditionalCheckFailedException'), {
          code: 'ConditionalCheckFailedException'
        })
      )
    });

    // getExistingOrder — returns idempotency record with linkedOrderId
    mockGet.mockReturnValueOnce({
      promise: jest.fn().mockResolvedValue({
        Item: {
          orderId: 'IDEMPOTENCY#idem-key-001',
          linkedOrderId: 'original-order-id',
          userId: 'user-123'
        }
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
    expect(res.body.userId).toBe('user-123');
    expect(res.body.totalAmount).toBe(200);
    expect(res.body.status).toBe('CREATED');
  });
});

describe('Integration: GET /orders/:userId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockScan.mockReturnValue({ promise: jest.fn().mockResolvedValue({ Items: [] }) });
  });

  // ─── 8. Returns orders with delivery/payment fields ───
  test('returns orders with deliveryAddress, paymentMethod, paymentDetails, totalAmount, status, createdAt', async () => {
    const orderRecord = {
      orderId: 'order-abc-123',
      userId: 'user-456',
      items: [{ productId: '1', name: 'Widget', quantity: 2, price: 100, lineTotal: 200 }],
      deliveryAddress: {
        street: '456 Oak Ave',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001'
      },
      paymentMethod: 'UPI',
      paymentDetails: { upiId: 'user@upi' },
      totalAmount: 200,
      status: 'CREATED',
      createdAt: '2024-06-15T10:30:00.000Z'
    };

    // Include an IDEMPOTENCY# record to verify it's filtered out
    const idempotencyRecord = {
      orderId: 'IDEMPOTENCY#some-key',
      userId: 'user-456',
      linkedOrderId: 'order-abc-123',
      createdAt: '2024-06-15T10:30:00.000Z'
    };

    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [orderRecord, idempotencyRecord]
      })
    });

    const res = await request(app)
      .get('/orders/user-456');

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBe(1);

    const order = res.body[0];
    expect(order.orderId).toBe('order-abc-123');
    expect(order.userId).toBe('user-456');
    expect(order.items).toBeInstanceOf(Array);
    expect(order.deliveryAddress).toEqual(orderRecord.deliveryAddress);
    expect(order.paymentMethod).toBe('UPI');
    expect(order.paymentDetails).toEqual({ upiId: 'user@upi' });
    expect(order.totalAmount).toBe(200);
    expect(order.status).toBe('CREATED');
    expect(order.createdAt).toBe('2024-06-15T10:30:00.000Z');

    // Verify IDEMPOTENCY# records are excluded
    const idempotencyOrders = res.body.filter(o => o.orderId.startsWith('IDEMPOTENCY#'));
    expect(idempotencyOrders.length).toBe(0);
  });

  // ─── 9. No orders returns empty array ───
  test('returns empty array when user has no orders', async () => {
    // Scan returns items for other users only
    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          { orderId: 'order-other', userId: 'other-user', items: [], status: 'CREATED' }
        ]
      })
    });

    const res = await request(app)
      .get('/orders/user-no-orders');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});
