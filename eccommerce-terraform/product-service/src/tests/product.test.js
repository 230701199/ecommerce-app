const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn();
  return res;
};

describe("Product Controller Tests", () => {

  beforeEach(() => {
    jest.resetModules(); // important
  });

  // ================= ADD PRODUCT =================

  test("addProduct should create product (admin)", async () => {
    jest.doMock('aws-sdk', () => ({
      DynamoDB: {
        DocumentClient: jest.fn(() => ({
          put: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({})
          })
        }))
      }
    }));

    const controller = require('../controllers/productController');

    const req = {
      headers: { role: "admin" },
      body: { name: "Test", price: 100, category: "test" }
    };

    const res = mockRes();
    const next = jest.fn();

    await controller.addProduct(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("addProduct should fail if not admin", async () => {
    jest.doMock('aws-sdk', () => ({
      DynamoDB: { DocumentClient: jest.fn(() => ({})) }
    }));

    const controller = require('../controllers/productController');

    const req = {
      headers: { role: "user" },
      body: { name: "Test", price: 100, category: "test" }
    };

    const res = mockRes();
    const next = jest.fn();

    await controller.addProduct(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("addProduct should fail if required fields missing", async () => {
    jest.doMock('aws-sdk', () => ({
      DynamoDB: { DocumentClient: jest.fn(() => ({})) }
    }));

    const controller = require('../controllers/productController');

    const req = {
      headers: { role: "admin" },
      body: {}
    };

    const res = mockRes();
    const next = jest.fn();

    await controller.addProduct(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  // ================= GET ALL =================

  test("getAllProducts should return products", async () => {
    jest.doMock('aws-sdk', () => ({
      DynamoDB: {
        DocumentClient: jest.fn(() => ({
          scan: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({ Items: [] })
          })
        }))
      }
    }));

    const controller = require('../controllers/productController');

    const req = {};
    const res = mockRes();
    const next = jest.fn();

    await controller.getAllProducts(req, res, next);

    expect(res.json).toHaveBeenCalled();
  });

  // ================= GET BY ID =================

  test("getProductById should return product", async () => {
    jest.doMock('aws-sdk', () => ({
      DynamoDB: {
        DocumentClient: jest.fn(() => ({
          get: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({ Item: { id: 1 } })
          })
        }))
      }
    }));

    const controller = require('../controllers/productController');

    const req = { params: { id: 1 } };
    const res = mockRes();
    const next = jest.fn();

    await controller.getProductById(req, res, next);

    expect(res.json).toHaveBeenCalled();
  });

  test("getProductById should fail if not found", async () => {
    jest.doMock('aws-sdk', () => ({
      DynamoDB: {
        DocumentClient: jest.fn(() => ({
          get: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({ Item: null })
          })
        }))
      }
    }));

    const controller = require('../controllers/productController');

    const req = { params: { id: 1 } };
    const res = mockRes();
    const next = jest.fn();

    await controller.getProductById(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404); // ✅ FIXED
  });

  // ================= DELETE =================

  test("deleteProduct should delete product", async () => {
    jest.doMock('aws-sdk', () => ({
      DynamoDB: {
        DocumentClient: jest.fn(() => ({
          delete: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({})
          })
        }))
      }
    }));

    const controller = require('../controllers/productController');

    const req = {
      headers: { role: "admin" },
      params: { id: 1 }
    };

    const res = mockRes();
    const next = jest.fn();

    await controller.deleteProduct(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      message: "Product deleted successfully"
    });
  });

  test("deleteProduct should fail if not admin", async () => {
    jest.doMock('aws-sdk', () => ({
      DynamoDB: { DocumentClient: jest.fn(() => ({})) }
    }));

    const controller = require('../controllers/productController');

    const req = {
      headers: { role: "user" },
      params: { id: 1 }
    };

    const res = mockRes();
    const next = jest.fn();

    await controller.deleteProduct(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  // ================= UPDATE =================

  test("updateProduct should fail if no fields", async () => {
    jest.doMock('aws-sdk', () => ({
      DynamoDB: { DocumentClient: jest.fn(() => ({})) }
    }));

    const controller = require('../controllers/productController');

    const req = {
      headers: { role: "admin" },
      params: { id: 1 },
      body: {}
    };

    const res = mockRes();
    const next = jest.fn();

    await controller.updateProduct(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("updateProduct should update product", async () => {
    jest.doMock('aws-sdk', () => ({
      DynamoDB: {
        DocumentClient: jest.fn(() => ({
          update: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({})
          })
        }))
      }
    }));

    const controller = require('../controllers/productController');

    const req = {
      headers: { role: "admin" },
      params: { id: 1 },
      body: { price: 200 }
    };

    const res = mockRes();
    const next = jest.fn();

    await controller.updateProduct(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      message: "Product updated successfully"
    });
  });

});