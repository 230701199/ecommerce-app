/**
 * business-metrics.js — NexMart Custom Business Metrics
 *
 * Publishes application events to the  NexMart/Business  CloudWatch
 * namespace using the AWS SDK v3 CloudWatch client.
 *
 * Usage — import the helper in any Lambda handler:
 *
 *   const { recordOrderPlaced, recordProductCreated, recordCartItemAdded }
 *     = require("../../business-metrics");
 *
 *   // inside handler:
 *   await recordOrderPlaced({ orderId, userId, totalAmount });
 *
 * Environment variable (auto-set by Lambda):
 *   AWS_REGION — used when constructing the CloudWatch client
 *
 * No additional IAM permissions are needed beyond the existing
 * cloudwatch:PutMetricData action, which is granted by the
 * aws_iam_role_policy_attachment.lambda_xray attachment added in
 * cloudwatch.tf (AWSXRayDaemonWriteAccess includes PutMetricData)
 * plus the baseline AWSLambdaBasicExecutionRole.
 *
 * If cloudwatch:PutMetricData is NOT covered by existing policies,
 * add the inline policy in iam.tf shown at the bottom of this file.
 */

"use strict";

const {
  CloudWatchClient,
  PutMetricDataCommand,
} = require("@aws-sdk/client-cloudwatch");

// Reuse the client across warm invocations to avoid repeated SDK init.
const cw = new CloudWatchClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

const NAMESPACE = "NexMart/Business";

/**
 * Low-level helper — publish one or more MetricData entries.
 * @param {import("@aws-sdk/client-cloudwatch").MetricDatum[]} metricData
 */
async function putMetrics(metricData) {
  try {
    await cw.send(
      new PutMetricDataCommand({
        Namespace:  NAMESPACE,
        MetricData: metricData,
      })
    );
  } catch (err) {
    // Never let a metrics failure crash the business handler.
    console.error("[business-metrics] PutMetricData failed:", err.message);
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Record a completed order.
 *
 * Emits:
 *   OrdersPlaced       (Count, +1)
 *   OrderValue         (None/USD, order total — used for avg / p99 analysis)
 *
 * @param {{ orderId: string, userId: string, totalAmount: number }} ctx
 */
async function recordOrderPlaced({ orderId, userId, totalAmount } = {}) {
  await putMetrics([
    {
      MetricName: "OrdersPlaced",
      Value:      1,
      Unit:       "Count",
      Timestamp:  new Date(),
      Dimensions: [{ Name: "Environment", Value: process.env.STAGE || "production" }],
    },
    ...(typeof totalAmount === "number"
      ? [{
          MetricName: "OrderValue",
          Value:      totalAmount,
          Unit:       "None",
          Timestamp:  new Date(),
          Dimensions: [{ Name: "Environment", Value: process.env.STAGE || "production" }],
        }]
      : []),
  ]);
}

/**
 * Record a new product being created by an admin.
 *
 * Emits:
 *   ProductsCreated    (Count, +1)
 *
 * @param {{ productId: string|number, category?: string }} ctx
 */
async function recordProductCreated({ productId, category } = {}) {
  await putMetrics([
    {
      MetricName: "ProductsCreated",
      Value:      1,
      Unit:       "Count",
      Timestamp:  new Date(),
      Dimensions: [
        { Name: "Environment", Value: process.env.STAGE || "production" },
        ...(category ? [{ Name: "Category", Value: String(category) }] : []),
      ],
    },
  ]);
}

/**
 * Record an item being added to a cart.
 *
 * Emits:
 *   CartItemsAdded     (Count, quantity)
 *
 * @param {{ userId: string, productId: string, quantity?: number }} ctx
 */
async function recordCartItemAdded({ userId, productId, quantity = 1 } = {}) {
  await putMetrics([
    {
      MetricName: "CartItemsAdded",
      Value:      quantity,
      Unit:       "Count",
      Timestamp:  new Date(),
      Dimensions: [{ Name: "Environment", Value: process.env.STAGE || "production" }],
    },
  ]);
}

module.exports = {
  recordOrderPlaced,
  recordProductCreated,
  recordCartItemAdded,
  // Expose putMetrics for any future custom metrics
  putMetrics,
  NAMESPACE,
};

/*
 * ─── INTEGRATION EXAMPLES ────────────────────────────────────────────────────
 *
 * order-service/src/controllers/orderController.js
 * ────────────────────────────────────────────────
 *   const { recordOrderPlaced } = require("../../../business-metrics");
 *
 *   async function createOrder(req, res) {
 *     const order = await OrderService.place(req.body);
 *     await recordOrderPlaced({
 *       orderId:     order.orderId,
 *       userId:      order.userId,
 *       totalAmount: order.totalAmount,
 *     });
 *     res.json({ success: true, data: order });
 *   }
 *
 *
 * product-service/src/controllers/productController.js
 * ─────────────────────────────────────────────────────
 *   const { recordProductCreated } = require("../../../business-metrics");
 *
 *   async function createProduct(req, res) {
 *     const product = await ProductService.create(req.body);
 *     await recordProductCreated({
 *       productId: product.id,
 *       category:  product.category,
 *     });
 *     res.json({ success: true, data: product });
 *   }
 *
 *
 * cart-service/src/application/usecases/addItemToCart.js
 * ───────────────────────────────────────────────────────
 *   const { recordCartItemAdded } = require("../../../../business-metrics");
 *
 *   async function addItemToCart({ userId, productId, quantity }) {
 *     await CartRepository.upsert({ userId, productId, quantity });
 *     await recordCartItemAdded({ userId, productId, quantity });
 *   }
 *
 *
 * ─── REQUIRED IAM ADDITION (iam.tf) ─────────────────────────────────────────
 *
 * If cloudwatch:PutMetricData is not already covered, add this to iam.tf:
 *
 *   resource "aws_iam_role_policy" "lambda_cloudwatch_metrics" {
 *     name = "${var.project_name}-lambda-custom-metrics"
 *     role = aws_iam_role.lambda_exec_role.id
 *
 *     policy = jsonencode({
 *       Version = "2012-10-17"
 *       Statement = [{
 *         Effect   = "Allow"
 *         Action   = ["cloudwatch:PutMetricData"]
 *         Resource = "*"
 *         Condition = {
 *           StringEquals = {
 *             "cloudwatch:namespace" = "NexMart/Business"
 *           }
 *         }
 *       }]
 *     })
 *   }
 */
