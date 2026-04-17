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

AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
  put: mockPut,
  update: mockUpdate,
  scan: jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({ Items: [] })
  })
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

});

// ✅ Cleanup (fix Jest hanging issue)
afterAll(() => {
  jest.clearAllMocks();
});