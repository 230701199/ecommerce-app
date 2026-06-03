// ✅ MOCK FIRST (VERY IMPORTANT)
jest.mock('aws-sdk');
jest.mock('axios');

const AWS = require('aws-sdk');
const axios = require('axios');

// ✅ Mock DynamoDB BEFORE importing app
const mockPut = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue({})
});

const mockUpdate = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue({})
});

const mockGet = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue({ Item: { orderId: "o1", status: "PENDING" } })
});

const mockScan = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue({ Items: [{ orderId: "o1", userId: "u1", status: "PENDING", totalAmount: 100, createdAt: "2026-06-03T18:00:00Z" }] })
});

AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
  put: mockPut,
  update: mockUpdate,
  get: mockGet,
  scan: mockScan
}));

const mockAdminGetUser = jest.fn().mockReturnValue({
  promise: jest.fn().mockResolvedValue({
    UserAttributes: [{ Name: 'email', Value: 'test@example.com' }]
  })
});

AWS.CognitoIdentityServiceProvider = jest.fn().mockImplementation(() => ({
  adminGetUser: mockAdminGetUser
}));

// ✅ IMPORT AFTER MOCK
const app = require('./server');
const request = require('supertest');

// ================= TESTS =================

describe("Order Service", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should fail if userId missing", async () => {
    const res = await request(app)
      .post('/orders')
      .send({});

    expect(res.statusCode).toBe(400);
  });

  test("should fail if cart empty", async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    const res = await request(app)
      .post('/orders')
      .send({ userId: "u1" });

    expect(res.statusCode).toBe(400);
  });

  test("should create order successfully", async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [{ productId: "1", quantity: 2 }]
      })
      .mockResolvedValueOnce({
        data: [{ id: 1, price: 100, stock: 10 }]
      });

    axios.delete.mockResolvedValue({});

    const res = await request(app)
      .post('/orders')
      .send({ userId: "u1" });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("orderId");
  });

  test("should fail if product not found", async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [{ productId: "999", quantity: 1 }]
      })
      .mockResolvedValueOnce({
        data: [{ id: 1, price: 100, stock: 10 }]
      });

    const res = await request(app)
      .post('/orders')
      .send({ userId: "u1" });

    expect(res.statusCode).toBe(400);
  });

  test("should fail if stock insufficient", async () => {
    axios.get
      .mockResolvedValueOnce({
        data: [{ productId: "1", quantity: 10 }]
      })
      .mockResolvedValueOnce({
        data: [{ id: 1, price: 100, stock: 2 }]
      });

    const res = await request(app)
      .post('/orders')
      .send({ userId: "u1" });

    expect(res.statusCode).toBe(400);
  });

  // ================= ADMIN TESTS =================

  describe("Admin Order Endpoints", () => {
    test("GET /admin/orders should return orders with email for admin user", async () => {
      const res = await request(app)
        .get('/admin/orders')
        .set('role', 'admin');

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty("email", "test@example.com");
    });

    test("GET /admin/orders should fail with 403 if user is not admin", async () => {
      const res = await request(app)
        .get('/admin/orders')
        .set('role', 'user');

      expect(res.statusCode).toBe(403);
    });

    test("PUT /admin/orders/:orderId/status should succeed for admin and valid status", async () => {
      mockGet.mockReturnValueOnce({ promise: () => Promise.resolve({ Item: { orderId: "o1", status: "PENDING" } }) });

      const res = await request(app)
        .put('/admin/orders/o1/status')
        .set('role', 'admin')
        .send({ status: "SHIPPED" });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain("successfully");
    });

    test("PUT /admin/orders/:orderId/status should fail with 400 for invalid status", async () => {
      const res = await request(app)
        .put('/admin/orders/o1/status')
        .set('role', 'admin')
        .send({ status: "INVALID_STATUS" });

      expect(res.statusCode).toBe(400);
    });

    test("PUT /admin/orders/:orderId/status should fail with 404 for missing order", async () => {
      mockGet.mockReturnValueOnce({ promise: () => Promise.resolve({ Item: null }) });

      const res = await request(app)
        .put('/admin/orders/missing_order/status')
        .set('role', 'admin')
        .send({ status: "SHIPPED" });

      expect(res.statusCode).toBe(404);
    });

    test("PUT /admin/orders/:orderId/status should fail with 403 if user is not admin", async () => {
      const res = await request(app)
        .put('/admin/orders/o1/status')
        .set('role', 'user')
        .send({ status: "SHIPPED" });

      expect(res.statusCode).toBe(403);
    });
  });

});

// ✅ Cleanup (fix Jest hanging issue)
afterAll(() => {
  jest.clearAllMocks();
});