const AWS = require('aws-sdk');
const { asyncHandler } = require('../utils/asyncHandler');
const { recordProductCreated } = require('../business-metrics');

const dynamo = new AWS.DynamoDB.DocumentClient({
  region: 'ap-southeast-1'
});

const TABLE = 'asif-products';

// Cognito Admin Authorization
// function requireAdmin(req) {
//   const claims = req.apiGateway?.event?.requestContext?.authorizer?.claims;
//   const groups = claims?.['cognito:groups'] || "";
//   const groupList =
//     typeof groups === 'string'
//       ? groups.split(',')
//       : groups || [];

//   if (!groupList.includes('admin')) {
//     const err = new Error('Admin access required');
//     err.statusCode = 403;
//     throw err;
//   }
// }
// function requireAdmin(req) {
//   const claims =
//     req.apiGateway?.event?.requestContext?.authorizer?.jwt?.claims ||
//     req.apiGateway?.event?.requestContext?.authorizer?.claims;

//   console.log("AUTH CLAIMS:", JSON.stringify(claims));

//   const groups = claims?.["cognito:groups"] || "";

//   const groupList =
//     typeof groups === "string"
//       ? groups.split(",")
//       : groups || [];

//   if (!groupList.includes("admin")) {
//     const err = new Error("Admin access required");
//     err.statusCode = 403;
//     throw err;
//   }
// }

function requireAdmin(req) {
  console.log(
    "AUTHORIZER:",
    JSON.stringify(
      req.apiGateway?.event?.requestContext?.authorizer,
      null,
      2
    )
  );

  const claims =
    req.apiGateway?.event?.requestContext?.authorizer?.jwt?.claims ||
    req.apiGateway?.event?.requestContext?.authorizer?.claims;

  console.log("CLAIMS:", JSON.stringify(claims));

  const groups = claims?.["cognito:groups"] || "";

const groupList = Array.isArray(groups)
  ? groups
  : String(groups)
      .replace(/[\[\]]/g, "")
      .split(",")
      .map(g => g.trim());

  console.log("GROUPS:", groupList);

  // console.log("GROUPS:", groupList);

  if (!groupList.includes("admin")) {
    const err = new Error("Admin access required");
    err.statusCode = 403;
    throw err;
  }
}


// ================= ADD PRODUCT (ADMIN ONLY) =================

const addProduct = asyncHandler(async (req, res) => {
  requireAdmin(req); // Cognito Admin Authorization

  const { name, description, price, stock, category,discount } = req.body;

  if (!name || !price || !category) {
    res.status(400);
    throw new Error('name, price, category are required');
  }

  const product = {
    id: Date.now(), // number
    name,
    description: description ?? null,
    price: Number(price),
    stock: Number(stock || 0),
    category,
    discount: Number(discount || 0),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dynamo.put({
    TableName: TABLE,
    Item: product
  }).promise();

  // Record custom business metric
  try {
    await recordProductCreated({
      productId: product.id,
      category: product.category
    });
  } catch (metricErr) {
    console.error("Failed to record ProductCreated metric:", metricErr);
  }

  return res.status(201).json({
    data: product,
    meta: { storage: 'dynamodb' }
  });
});


// ================= GET ALL PRODUCTS =================

const getAllProducts = asyncHandler(async (req, res) => {
  const result = await dynamo.scan({
    TableName: TABLE
  }).promise();

  return res.json({
    data: (result.Items || []).map(p => ({
  ...p,
  finalPrice: p.price * (1 - (p.discount || 0) / 100)
})),
    meta: { storage: 'dynamodb' }
  });
});


// ================= GET PRODUCT BY ID =================

const getProductById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  const result = await dynamo.get({
    TableName: TABLE,
    Key: { id }
  }).promise();

  if (!result.Item) {
    res.status(404);
    throw new Error('Product not found');
  }

 const product = result.Item;

return res.json({
  data: {
    ...product,
    finalPrice: product.price * (1 - (product.discount || 0) / 100)
  },
  meta: { storage: 'dynamodb' }
});
});


// ================= DELETE PRODUCT (ADMIN ONLY) =================

const deleteProduct = asyncHandler(async (req, res) => {
  requireAdmin(req); // Cognito Admin Authorization

  const id = Number(req.params.id);

  await dynamo.delete({
    TableName: TABLE,
    Key: { id }
  }).promise();

  return res.json({
    message: "Product deleted successfully"
  });
});

const updateProduct = asyncHandler(async (req, res) => {
  requireAdmin(req); // Cognito Admin Authorization

  const id = Number(req.params.id);
  const { stock, price, name, category, description,discount } = req.body;

  const updateExp = [];
  const values = {};
  const names = {};

  if (stock !== undefined) {
    updateExp.push("#stock = :s");
    values[":s"] = Number(stock);
    names["#stock"] = "stock";
  }

  if (price !== undefined) {
    updateExp.push("#price = :p");
    values[":p"] = Number(price);
    names["#price"] = "price";
  }

  if (name) {
    updateExp.push("#name = :n");
    values[":n"] = name;
    names["#name"] = "name";
  }

  if (category) {
    updateExp.push("#category = :c");
    values[":c"] = category;
    names["#category"] = "category";
  }

  if (description !== undefined) {
    updateExp.push("#description = :d");
    values[":d"] = description;
    names["#description"] = "description";
  }
  if (discount !== undefined) {
  updateExp.push("#discount = :dsc");
  values[":dsc"] = Number(discount);
  names["#discount"] = "discount";
}

  // ❗ prevent empty update crash
  if (updateExp.length === 0) {
    res.status(400);
    throw new Error("No fields to update");
  }
   

  // always update timestamp
  updateExp.push("#updatedAt = :u");
  values[":u"] = new Date().toISOString();
  names["#updatedAt"] = "updatedAt";

  await dynamo.update({
    TableName: TABLE,
    Key: { id },
    UpdateExpression: "SET " + updateExp.join(", "),
    ExpressionAttributeValues: values,
    ExpressionAttributeNames: names
  }).promise();

  res.json({ message: "Product updated successfully" });
});

// ================= EXPORT =================

module.exports = {
  addProduct,
  getAllProducts,
  getProductById,
  deleteProduct,
  updateProduct
};