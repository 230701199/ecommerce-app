const { addItemToCart } = require('../application/usecases/addItemToCart');
const { getCartItems } = require('../application/usecases/getCartItems');
const { removeCartItem } = require('../application/usecases/removeCartItem');
const { AppError } = require('../domain/errors/AppError');

// ================= ADD ITEM =================

test("should add item to cart", async () => {
  const mockRepo = {
    addItem: jest.fn().mockResolvedValue({
      userId: "u1",
      productId: "p1",
      quantity: 2
    })
  };

  const result = await addItemToCart({
    cartRepository: mockRepo,
    input: {
      userId: "u1",
      productId: "p1",
      quantity: 2
    }
  });

  expect(result.quantity).toBe(2);
  expect(mockRepo.addItem).toHaveBeenCalled();
});

test("should fail if missing userId", async () => {
  const mockRepo = {};

  await expect(addItemToCart({
    cartRepository: mockRepo,
    input: {
      productId: "p1",
      quantity: 1
    }
  })).rejects.toThrow(AppError);
});

test("should fail for invalid quantity", async () => {
  const mockRepo = {};

  await expect(addItemToCart({
    cartRepository: mockRepo,
    input: {
      userId: "u1",
      productId: "p1",
      quantity: 0
    }
  })).rejects.toThrow(AppError);
});


// ================= GET CART =================

test("should get cart items", async () => {
  const mockRepo = {
    getItemsByUserId: jest.fn().mockResolvedValue([
      { productId: "p1", quantity: 2 }
    ])
  };

  const result = await getCartItems({
    cartRepository: mockRepo,
    userId: "u1"
  });

  expect(result.length).toBe(1);
  expect(mockRepo.getItemsByUserId).toHaveBeenCalledWith("u1");
});

test("should fail if userId missing", async () => {
  const mockRepo = {};

  await expect(getCartItems({
    cartRepository: mockRepo
  })).rejects.toThrow(AppError);
});


// ================= REMOVE ITEM =================

test("should remove cart item", async () => {
  const mockRepo = {
    removeItem: jest.fn().mockResolvedValue()
  };

  const result = await removeCartItem({
    cartRepository: mockRepo,
    userId: "u1",
    productId: "p1"
  });

  expect(result.removed).toBe(true);
  expect(mockRepo.removeItem).toHaveBeenCalled();
});

test("should fail if productId missing", async () => {
  const mockRepo = {};

  await expect(removeCartItem({
    cartRepository: mockRepo,
    userId: "u1"
  })).rejects.toThrow(AppError);
});