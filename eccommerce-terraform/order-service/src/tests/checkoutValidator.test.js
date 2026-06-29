const request = require('supertest');
const express = require('express');
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

const validPayload = {
  userId: 'user-123',
  deliveryAddress: {
    street: '123 Main Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    landmark: 'Near the station',
  },
  paymentMethod: 'COD',
  paymentDetails: {},
};

describe('Checkout Validator', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('valid requests', () => {
    it('should accept a valid COD request', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send(validPayload);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should accept a valid UPI request with valid upiId', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send({
          ...validPayload,
          paymentMethod: 'UPI',
          paymentDetails: { upiId: 'user@oksbi' },
        });
      expect(res.status).toBe(200);
    });

    it('should accept request without landmark (optional)', async () => {
      const payload = { ...validPayload };
      payload.deliveryAddress = { ...validPayload.deliveryAddress };
      delete payload.deliveryAddress.landmark;
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(200);
    });
  });

  describe('userId validation', () => {
    it('should reject missing userId', async () => {
      const payload = { ...validPayload };
      delete payload.userId;
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('userId');
    });

    it('should reject empty userId', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send({ ...validPayload, userId: '' });
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('userId');
    });

    it('should reject whitespace-only userId', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send({ ...validPayload, userId: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('userId');
    });
  });

  describe('deliveryAddress validation', () => {
    it('should reject missing street', async () => {
      const payload = { ...validPayload, deliveryAddress: { ...validPayload.deliveryAddress } };
      delete payload.deliveryAddress.street;
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('deliveryAddress.street');
    });

    it('should reject empty city', async () => {
      const payload = { ...validPayload, deliveryAddress: { ...validPayload.deliveryAddress, city: '' } };
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('deliveryAddress.city');
    });

    it('should reject state exceeding 100 characters', async () => {
      const payload = { ...validPayload, deliveryAddress: { ...validPayload.deliveryAddress, state: 'A'.repeat(101) } };
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('deliveryAddress.state');
    });

    it('should reject street exceeding 200 characters', async () => {
      const payload = { ...validPayload, deliveryAddress: { ...validPayload.deliveryAddress, street: 'A'.repeat(201) } };
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('deliveryAddress.street');
    });

    it('should reject landmark exceeding 200 characters', async () => {
      const payload = { ...validPayload, deliveryAddress: { ...validPayload.deliveryAddress, landmark: 'A'.repeat(201) } };
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('deliveryAddress.landmark');
    });
  });

  describe('pincode validation', () => {
    it('should reject pincode with non-digit characters', async () => {
      const payload = { ...validPayload, deliveryAddress: { ...validPayload.deliveryAddress, pincode: '40000a' } };
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('deliveryAddress.pincode');
    });

    it('should reject pincode with fewer than 6 digits', async () => {
      const payload = { ...validPayload, deliveryAddress: { ...validPayload.deliveryAddress, pincode: '40001' } };
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('deliveryAddress.pincode');
    });

    it('should reject pincode with more than 6 digits', async () => {
      const payload = { ...validPayload, deliveryAddress: { ...validPayload.deliveryAddress, pincode: '4000012' } };
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('deliveryAddress.pincode');
    });
  });

  describe('paymentMethod validation', () => {
    it('should reject missing paymentMethod', async () => {
      const payload = { ...validPayload };
      delete payload.paymentMethod;
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('paymentMethod');
    });

    it('should reject invalid paymentMethod', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send({ ...validPayload, paymentMethod: 'CARD' });
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('paymentMethod');
    });
  });

  describe('UPI ID conditional validation', () => {
    it('should reject UPI payment without upiId', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send({
          ...validPayload,
          paymentMethod: 'UPI',
          paymentDetails: {},
        });
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('paymentDetails.upiId');
    });

    it('should reject UPI payment with invalid upiId format', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send({
          ...validPayload,
          paymentMethod: 'UPI',
          paymentDetails: { upiId: 'invalid-no-at' },
        });
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('paymentDetails.upiId');
    });

    it('should reject UPI payment with upiId shorter than 3 chars', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send({
          ...validPayload,
          paymentMethod: 'UPI',
          paymentDetails: { upiId: 'a@' },
        });
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('paymentDetails.upiId');
    });

    it('should reject UPI payment with upiId longer than 50 chars', async () => {
      const longUpi = 'a'.repeat(40) + '@' + 'b'.repeat(10);
      const res = await request(app)
        .post('/orders/checkout')
        .send({
          ...validPayload,
          paymentMethod: 'UPI',
          paymentDetails: { upiId: longUpi },
        });
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('paymentDetails.upiId');
    });

    it('should not validate upiId when paymentMethod is COD', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send({
          ...validPayload,
          paymentMethod: 'COD',
          paymentDetails: {},
        });
      expect(res.status).toBe(200);
    });
  });

  describe('idempotencyKey validation', () => {
    it('should accept request without idempotencyKey (optional)', async () => {
      const payload = { ...validPayload };
      delete payload.idempotencyKey;
      const res = await request(app)
        .post('/orders/checkout')
        .send(payload);
      expect(res.status).toBe(200);
    });

    it('should accept request with valid idempotencyKey', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send({ ...validPayload, idempotencyKey: 'key-abc-123' });
      expect(res.status).toBe(200);
    });
  });

  describe('multiple validation errors', () => {
    it('should return all invalid fields at once', async () => {
      const res = await request(app)
        .post('/orders/checkout')
        .send({
          userId: '',
          deliveryAddress: {
            street: '',
            city: '',
            state: '',
            pincode: '123',
          },
          paymentMethod: 'INVALID',
        });
      expect(res.status).toBe(400);
      expect(res.body.fields).toContain('userId');
      expect(res.body.fields).toContain('deliveryAddress.street');
      expect(res.body.fields).toContain('deliveryAddress.city');
      expect(res.body.fields).toContain('deliveryAddress.state');
      expect(res.body.fields).toContain('deliveryAddress.pincode');
      expect(res.body.fields).toContain('paymentMethod');
    });
  });
});
