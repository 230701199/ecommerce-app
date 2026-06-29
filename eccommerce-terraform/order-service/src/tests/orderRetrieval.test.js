// ✅ MOCK FIRST (VERY IMPORTANT)
jest.mock('aws-sdk');
jest.mock('axios');
jest.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PutMetricDataCommand: jest.fn()
}), { virtual: true });

const AWS = require('aws-sdk');

// ✅ Mock DynamoDB BEFORE importing app
const mockScan = jest.fn();

AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
  put: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) }),
  update: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) }),
  get: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ Item: null }) }),
  scan: mockScan
}));

AWS.CognitoIdentityServiceProvider = jest.fn().mockImplementation(() => ({
  adminGetUser: jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({
      UserAttributes: [{ Name: 'email', Value: 'test@example.com' }]
    })
  })
}));

// ✅ IMPORT AFTER MOCK
const app = require('../server');
const request = require('supertest');

// ================= TESTS =================

describe('GET /orders/:userId - Order Retrieval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return all enhanced fields (deliveryAddress, paymentMethod, paymentDetails, totalAmount, status, createdAt)', async () => {
    const mockOrder = {
      orderId: 'order-123',
      userId: 'user-1',
      items: [
        { productId: 'p1', name: 'Widget', quantity: 2, price: 50, lineTotal: 100 }
      ],
      deliveryAddress: {
        street: '123 Main St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        landmark: 'Near park'
      },
      paymentMethod: 'UPI',
      paymentDetails: { upiId: 'user@upi' },
      totalAmount: 100,
      status: 'CREATED',
      createdAt: '2024-01-15T10:30:00.000Z'
    };

    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [mockOrder] })
    });

    const res = await request(app).get('/orders/user-1');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);

    const order = res.body[0];
    expect(order.orderId).toBe('order-123');
    expect(order.userId).toBe('user-1');
    expect(order.items).toEqual([
      { productId: 'p1', name: 'Widget', quantity: 2, price: 50, lineTotal: 100 }
    ]);
    expect(order.deliveryAddress).toEqual({
      street: '123 Main St',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      landmark: 'Near park'
    });
    expect(order.paymentMethod).toBe('UPI');
    expect(order.paymentDetails).toEqual({ upiId: 'user@upi' });
    expect(order.totalAmount).toBe(100);
    expect(order.status).toBe('CREATED');
    expect(order.createdAt).toBe('2024-01-15T10:30:00.000Z');
  });

  test('should return COD order with empty paymentDetails', async () => {
    const mockOrder = {
      orderId: 'order-456',
      userId: 'user-2',
      items: [{ productId: 'p2', name: 'Gadget', quantity: 1, price: 200, lineTotal: 200 }],
      deliveryAddress: {
        street: '456 Oak Ave',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001'
      },
      paymentMethod: 'COD',
      paymentDetails: {},
      totalAmount: 200,
      status: 'CREATED',
      createdAt: '2024-02-10T14:00:00.000Z'
    };

    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [mockOrder] })
    });

    const res = await request(app).get('/orders/user-2');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);

    const order = res.body[0];
    expect(order.paymentMethod).toBe('COD');
    expect(order.paymentDetails).toEqual({});
    expect(order.totalAmount).toBe(200);
    expect(order.status).toBe('CREATED');
    expect(order.createdAt).toBe('2024-02-10T14:00:00.000Z');
  });

  test('should return empty array for non-existent user', async () => {
    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [] })
    });

    const res = await request(app).get('/orders/non-existent-user');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('should return empty array when table has orders but none for the requested user', async () => {
    const mockOrder = {
      orderId: 'order-789',
      userId: 'other-user',
      items: [{ productId: 'p1', name: 'Widget', quantity: 1, price: 50, lineTotal: 50 }],
      deliveryAddress: { street: '1 St', city: 'City', state: 'State', pincode: '123456' },
      paymentMethod: 'COD',
      paymentDetails: {},
      totalAmount: 50,
      status: 'CREATED',
      createdAt: '2024-03-01T09:00:00.000Z'
    };

    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [mockOrder] })
    });

    const res = await request(app).get('/orders/non-existent-user');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('should exclude IDEMPOTENCY# prefixed records from results', async () => {
    const validOrder = {
      orderId: 'order-abc',
      userId: 'user-3',
      items: [{ productId: 'p1', name: 'Widget', quantity: 1, price: 75, lineTotal: 75 }],
      deliveryAddress: { street: '789 Pine Rd', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
      paymentMethod: 'UPI',
      paymentDetails: { upiId: 'test@okaxis' },
      totalAmount: 75,
      status: 'CREATED',
      createdAt: '2024-04-01T12:00:00.000Z'
    };

    const idempotencyRecord = {
      orderId: 'IDEMPOTENCY#some-key-uuid',
      userId: 'user-3',
      linkedOrderId: 'order-abc',
      createdAt: '2024-04-01T12:00:00.000Z',
      ttl: 1712000430
    };

    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [validOrder, idempotencyRecord] })
    });

    const res = await request(app).get('/orders/user-3');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].orderId).toBe('order-abc');
    // Ensure no IDEMPOTENCY# records in the response
    res.body.forEach((order) => {
      expect(order.orderId).not.toMatch(/^IDEMPOTENCY#/);
    });
  });

  test('should exclude multiple IDEMPOTENCY# records and return only actual orders', async () => {
    const order1 = {
      orderId: 'order-001',
      userId: 'user-4',
      items: [{ productId: 'p1', name: 'Item A', quantity: 2, price: 30, lineTotal: 60 }],
      deliveryAddress: { street: '10 St', city: 'Pune', state: 'Maharashtra', pincode: '411001' },
      paymentMethod: 'COD',
      paymentDetails: {},
      totalAmount: 60,
      status: 'CREATED',
      createdAt: '2024-05-01T08:00:00.000Z'
    };

    const order2 = {
      orderId: 'order-002',
      userId: 'user-4',
      items: [{ productId: 'p2', name: 'Item B', quantity: 1, price: 150, lineTotal: 150 }],
      deliveryAddress: { street: '20 St', city: 'Pune', state: 'Maharashtra', pincode: '411002' },
      paymentMethod: 'UPI',
      paymentDetails: { upiId: 'user4@ybl' },
      totalAmount: 150,
      status: 'CREATED',
      createdAt: '2024-05-02T10:00:00.000Z'
    };

    const idempotency1 = {
      orderId: 'IDEMPOTENCY#key-1',
      userId: 'user-4',
      linkedOrderId: 'order-001',
      createdAt: '2024-05-01T08:00:00.000Z',
      ttl: 1714560030
    };

    const idempotency2 = {
      orderId: 'IDEMPOTENCY#key-2',
      userId: 'user-4',
      linkedOrderId: 'order-002',
      createdAt: '2024-05-02T10:00:00.000Z',
      ttl: 1714650030
    };

    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [order1, order2, idempotency1, idempotency2]
      })
    });

    const res = await request(app).get('/orders/user-4');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((o) => o.orderId).sort()).toEqual(['order-001', 'order-002']);
    res.body.forEach((order) => {
      expect(order.orderId).not.toMatch(/^IDEMPOTENCY#/);
    });
  });

  test('should handle missing optional fields with defaults', async () => {
    // Simulate a legacy order that may not have all enhanced fields
    const legacyOrder = {
      orderId: 'old-order-1',
      userId: 'user-5',
      items: [{ productId: 'p1', name: 'Legacy Item', quantity: 1, price: 25, lineTotal: 25 }]
      // Missing: deliveryAddress, paymentMethod, paymentDetails, totalAmount, status, createdAt
    };

    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [legacyOrder] })
    });

    const res = await request(app).get('/orders/user-5');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);

    const order = res.body[0];
    expect(order.deliveryAddress).toBeNull();
    expect(order.paymentMethod).toBeNull();
    expect(order.paymentDetails).toEqual({});
    expect(order.totalAmount).toBe(0);
    expect(order.status).toBe('CREATED');
    expect(order.createdAt).toBeNull();
  });
});

// ✅ Cleanup
afterAll(() => {
  jest.clearAllMocks();
});
