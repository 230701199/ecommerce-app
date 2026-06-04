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
 */
async function recordOrderPlaced({ orderId, userId, totalAmount } = {}) {
  await putMetrics([
    {
      MetricName: "OrdersPlaced",
      Value:      1,
      Unit:       "Count",
      Timestamp:  new Date(),
    },
    ...(typeof totalAmount === "number"
      ? [{
          MetricName: "OrderValue",
          Value:      totalAmount,
          Unit:       "None",
          Timestamp:  new Date(),
        }]
      : []),
  ]);
}

/**
 * Record a new product being created by an admin.
 *
 * Emits:
 *   ProductsCreated    (Count, +1)
 */
async function recordProductCreated({ productId, category } = {}) {
  await putMetrics([
    {
      MetricName: "ProductsCreated",
      Value:      1,
      Unit:       "Count",
      Timestamp:  new Date(),
    },
  ]);
}

/**
 * Record an item being added to a cart.
 *
 * Emits:
 *   CartItemsAdded     (Count, quantity)
 */
async function recordCartItemAdded({ userId, productId, quantity = 1 } = {}) {
  await putMetrics([
    {
      MetricName: "CartItemsAdded",
      Value:      quantity,
      Unit:       "Count",
      Timestamp:  new Date(),
    },
  ]);
}

module.exports = {
  recordOrderPlaced,
  recordProductCreated,
  recordCartItemAdded,
  putMetrics,
  NAMESPACE,
};
