# =============================================================================
# cloudwatch.tf - NexMart Observability (asif naming standard)
# =============================================================================

# NOTE: The CloudFront distribution (E31INVU26UD3MB / d32dvut05ll57l.cloudfront.net)
# is managed in a separate Terraform project (frontend-terraform).
# It is NOT looked up via a data source here to avoid cross-state dependencies.
# The distribution ID is supplied directly via var.cloudfront_distribution_id.

# LOCALS
locals {
  app_lambdas = {
    product = aws_lambda_function.product_service
    cart    = aws_lambda_function.cart_service
    order   = aws_lambda_function.order_service
  }
  dynamo_tables = {
    products = aws_dynamodb_table.products
    cart     = aws_dynamodb_table.cart
    orders   = aws_dynamodb_table.orders
  }
  apigw_id      = aws_apigatewayv2_api.api.id
  apigw_name    = aws_apigatewayv2_api.api.name
  apigw_stage   = "$default"
  alarm_actions = [aws_sns_topic.alerts.arn]
  cf_id         = var.cloudfront_distribution_id
  region        = var.region
}

# 1. OPTIONAL EXTRA SNS SUBSCRIPTION
resource "aws_sns_topic_subscription" "asif_monitoring_email" {
  count     = var.alert_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# 2. LOG GROUPS - removed: already created automatically by Lambda.
# Declaring them here caused ResourceAlreadyExistsException on apply.
# Retention policy can be set manually in the AWS Console if required.

# 3. LAMBDA ALARMS
resource "aws_cloudwatch_metric_alarm" "asif_lambda_errors" {
  for_each            = local.app_lambdas
  alarm_name          = "asif-${each.key}-errors"
  alarm_description   = "Lambda ${each.key} errors > ${var.lambda_error_threshold} in 1 min"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  dimensions          = { FunctionName = each.value.function_name }
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = var.lambda_error_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = { Project = var.project_name, Service = each.key }
}

resource "aws_cloudwatch_metric_alarm" "asif_lambda_duration" {
  for_each            = local.app_lambdas
  alarm_name          = "asif-${each.key}-duration"
  alarm_description   = "Lambda ${each.key} p99 duration > ${var.lambda_duration_threshold_ms} ms"
  namespace           = "AWS/Lambda"
  metric_name         = "Duration"
  dimensions          = { FunctionName = each.value.function_name }
  extended_statistic  = "p99"
  period              = 60
  evaluation_periods  = 3
  threshold           = var.lambda_duration_threshold_ms
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = { Project = var.project_name, Service = each.key }
}

resource "aws_cloudwatch_metric_alarm" "asif_lambda_throttles" {
  for_each            = local.app_lambdas
  alarm_name          = "asif-${each.key}-throttles"
  alarm_description   = "Lambda ${each.key} is being throttled"
  namespace           = "AWS/Lambda"
  metric_name         = "Throttles"
  dimensions          = { FunctionName = each.value.function_name }
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = var.lambda_throttle_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = { Project = var.project_name, Service = each.key }
}

# 4. API GATEWAY ALARMS
resource "aws_cloudwatch_metric_alarm" "asif_api_4xx_errors" {
  alarm_name          = "asif-api-4xx-errors"
  alarm_description   = "API Gateway 4XX errors > ${var.apigw_4xx_threshold} in 1 min"
  namespace           = "AWS/ApiGateway"
  metric_name         = "4XXError"
  dimensions          = { ApiId = local.apigw_id, Stage = local.apigw_stage }
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = var.apigw_4xx_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = { Project = var.project_name }
}

resource "aws_cloudwatch_metric_alarm" "asif_api_5xx_errors" {
  alarm_name          = "asif-api-5xx-errors"
  alarm_description   = "API Gateway 5XX errors > ${var.apigw_5xx_threshold} in 1 min"
  namespace           = "AWS/ApiGateway"
  metric_name         = "5XXError"
  dimensions          = { ApiId = local.apigw_id, Stage = local.apigw_stage }
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = var.apigw_5xx_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = { Project = var.project_name }
}

resource "aws_cloudwatch_metric_alarm" "asif_api_latency" {
  alarm_name          = "asif-api-latency"
  alarm_description   = "API Gateway p99 integration latency > ${var.apigw_latency_threshold_ms} ms"
  namespace           = "AWS/ApiGateway"
  metric_name         = "IntegrationLatency"
  dimensions          = { ApiId = local.apigw_id, Stage = local.apigw_stage }
  extended_statistic  = "p99"
  period              = 60
  evaluation_periods  = 3
  threshold           = var.apigw_latency_threshold_ms
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = { Project = var.project_name }
}

# 5. DYNAMODB ALARMS
resource "aws_cloudwatch_metric_alarm" "asif_dynamo_throttles" {
  for_each            = local.dynamo_tables
  alarm_name          = "asif-${each.key}-throttled"
  alarm_description   = "DynamoDB ${each.value.name} throttled > ${var.dynamo_throttle_threshold}"
  namespace           = "AWS/DynamoDB"
  metric_name         = "ThrottledRequests"
  dimensions          = { TableName = each.value.name }
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = var.dynamo_throttle_threshold
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = { Project = var.project_name, Table = each.key }
}

resource "aws_cloudwatch_metric_alarm" "asif_dynamo_system_errors" {
  for_each            = local.dynamo_tables
  alarm_name          = "asif-${each.key}-system-errors"
  alarm_description   = "DynamoDB ${each.value.name} has system errors"
  namespace           = "AWS/DynamoDB"
  metric_name         = "SystemErrors"
  dimensions          = { TableName = each.value.name }
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  tags                = { Project = var.project_name, Table = each.key }
}

# 6. CLOUDFRONT ALARMS - removed: AccessDenied on cloudwatch:PutMetricAlarm
# for CloudFront metrics in us-east-1 with the current IAM role.
# CloudFront metrics are still visible in the dashboard widgets below.

# 7. X-RAY IAM ATTACHMENT
resource "aws_iam_role_policy_attachment" "asif_lambda_xray" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}


# 8. DASHBOARD - NexMart-Asif-Dashboard
# All widget attributes use valid HCL: one attribute per line, no semicolons.
resource "aws_cloudwatch_dashboard" "asif_nexmart" {
  dashboard_name = "NexMart-Asif-Dashboard"

  dashboard_body = jsonencode({
    widgets = [

      # ── Header ──────────────────────────────────────────────────────────
      {
        type   = "text"
        x      = 0
        y      = 0
        width  = 24
        height = 1
        properties = {
          markdown = "# NexMart-Asif — Production Observability | Region: ${local.region}"
        }
      },

      # ── Section 1: API Gateway ───────────────────────────────────────────
      {
        type   = "text"
        x      = 0
        y      = 1
        width  = 24
        height = 1
        properties = {
          markdown = "## API Gateway"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 2
        width  = 6
        height = 6
        properties = {
          title  = "Request Count"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", local.apigw_id, "Stage", local.apigw_stage]
          ]
        }
      },
      {
        type   = "metric"
        x      = 6
        y      = 2
        width  = 6
        height = 6
        properties = {
          title  = "4XX Errors"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["AWS/ApiGateway", "4XXError", "ApiId", local.apigw_id, "Stage", local.apigw_stage]
          ]
          annotations = {
            horizontal = [{ value = var.apigw_4xx_threshold, label = "Alarm", color = "#ff6b35" }]
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 2
        width  = 6
        height = 6
        properties = {
          title  = "5XX Errors"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["AWS/ApiGateway", "5XXError", "ApiId", local.apigw_id, "Stage", local.apigw_stage]
          ]
          annotations = {
            horizontal = [{ value = var.apigw_5xx_threshold, label = "Alarm", color = "#d13212" }]
          }
        }
      },
      {
        type   = "metric"
        x      = 18
        y      = 2
        width  = 6
        height = 6
        properties = {
          title  = "Latency p99 (ms)"
          view   = "timeSeries"
          stat   = "p99"
          period = 60
          region = local.region
          metrics = [
            ["AWS/ApiGateway", "IntegrationLatency", "ApiId", local.apigw_id, "Stage", local.apigw_stage]
          ]
          annotations = {
            horizontal = [{ value = var.apigw_latency_threshold_ms, label = "Alarm", color = "#ff6b35" }]
          }
        }
      },

      # ── Section 2: Lambda ────────────────────────────────────────────────
      {
        type   = "text"
        x      = 0
        y      = 8
        width  = 24
        height = 1
        properties = {
          markdown = "## Lambda Functions"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 9
        width  = 6
        height = 6
        properties = {
          title  = "Invocations"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.product_service.function_name, { label = "product" }],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.cart_service.function_name, { label = "cart" }],
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.order_service.function_name, { label = "order" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 6
        y      = 9
        width  = 6
        height = 6
        properties = {
          title  = "Errors"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.product_service.function_name, { label = "product", color = "#d13212" }],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.cart_service.function_name, { label = "cart", color = "#ff6b35" }],
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.order_service.function_name, { label = "order", color = "#ff9900" }]
          ]
          annotations = {
            horizontal = [{ value = var.lambda_error_threshold, label = "Alarm", color = "#d13212" }]
          }
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 9
        width  = 6
        height = 6
        properties = {
          title  = "Duration p99 (ms)"
          view   = "timeSeries"
          stat   = "p99"
          period = 60
          region = local.region
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.product_service.function_name, { label = "product" }],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.cart_service.function_name, { label = "cart" }],
            ["AWS/Lambda", "Duration", "FunctionName", aws_lambda_function.order_service.function_name, { label = "order" }]
          ]
          annotations = {
            horizontal = [{ value = var.lambda_duration_threshold_ms, label = "Alarm", color = "#ff6b35" }]
          }
        }
      },
      {
        type   = "metric"
        x      = 18
        y      = 9
        width  = 6
        height = 6
        properties = {
          title  = "Throttles"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["AWS/Lambda", "Throttles", "FunctionName", aws_lambda_function.product_service.function_name, { label = "product" }],
            ["AWS/Lambda", "Throttles", "FunctionName", aws_lambda_function.cart_service.function_name, { label = "cart" }],
            ["AWS/Lambda", "Throttles", "FunctionName", aws_lambda_function.order_service.function_name, { label = "order" }]
          ]
        }
      },

      # ── Section 3: DynamoDB ──────────────────────────────────────────────
      {
        type   = "text"
        x      = 0
        y      = 15
        width  = 24
        height = 1
        properties = {
          markdown = "## DynamoDB Tables"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 16
        width  = 8
        height = 6
        properties = {
          title  = "Consumed Read Capacity"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.products.name, { label = "products" }],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.cart.name, { label = "cart" }],
            ["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", aws_dynamodb_table.orders.name, { label = "orders" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 16
        width  = 8
        height = 6
        properties = {
          title  = "Consumed Write Capacity"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.products.name, { label = "products" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.cart.name, { label = "cart" }],
            ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", aws_dynamodb_table.orders.name, { label = "orders" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 16
        width  = 8
        height = 6
        properties = {
          title  = "Throttled Requests"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["AWS/DynamoDB", "ThrottledRequests", "TableName", aws_dynamodb_table.products.name, { label = "products", color = "#d13212" }],
            ["AWS/DynamoDB", "ThrottledRequests", "TableName", aws_dynamodb_table.cart.name, { label = "cart", color = "#ff6b35" }],
            ["AWS/DynamoDB", "ThrottledRequests", "TableName", aws_dynamodb_table.orders.name, { label = "orders", color = "#ff9900" }]
          ]
        }
      },

      # ── Section 4: CloudFront ────────────────────────────────────────────
      {
        type   = "text"
        x      = 0
        y      = 22
        width  = 24
        height = 1
        properties = {
          markdown = "## CloudFront Distribution"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 23
        width  = 6
        height = 6
        properties = {
          title  = "Requests"
          view   = "timeSeries"
          stat   = "Sum"
          period = 300
          region = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "Requests", "DistributionId", local.cf_id, "Region", "Global"]
          ]
        }
      },
      {
        type   = "metric"
        x      = 6
        y      = 23
        width  = 6
        height = 6
        properties = {
          title  = "Bytes Downloaded"
          view   = "timeSeries"
          stat   = "Sum"
          period = 300
          region = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "BytesDownloaded", "DistributionId", local.cf_id, "Region", "Global"]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 23
        width  = 6
        height = 6
        properties = {
          title  = "4XX Error Rate (%)"
          view   = "timeSeries"
          stat   = "Average"
          period = 300
          region = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "4xxErrorRate", "DistributionId", local.cf_id, "Region", "Global"]
          ]
          annotations = {
            horizontal = [{ value = var.cloudfront_4xx_threshold_pct, label = "Alarm", color = "#ff6b35" }]
          }
        }
      },
      {
        type   = "metric"
        x      = 18
        y      = 23
        width  = 6
        height = 6
        properties = {
          title  = "5XX Error Rate (%)"
          view   = "timeSeries"
          stat   = "Average"
          period = 300
          region = "us-east-1"
          metrics = [
            ["AWS/CloudFront", "5xxErrorRate", "DistributionId", local.cf_id, "Region", "Global"]
          ]
          annotations = {
            horizontal = [{ value = var.cloudfront_5xx_threshold_pct, label = "Alarm", color = "#d13212" }]
          }
        }
      },

      # ── Section 5: Business Metrics ──────────────────────────────────────
      {
        type   = "text"
        x      = 0
        y      = 29
        width  = 24
        height = 1
        properties = {
          markdown = "## Business Metrics — namespace: NexMart/Business"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 30
        width  = 8
        height = 6
        properties = {
          title  = "Orders Placed"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["NexMart/Business", "OrdersPlaced"]
          ]
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 30
        width  = 8
        height = 6
        properties = {
          title  = "Products Created"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["NexMart/Business", "ProductsCreated"]
          ]
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 30
        width  = 8
        height = 6
        properties = {
          title  = "Cart Items Added"
          view   = "timeSeries"
          stat   = "Sum"
          period = 60
          region = local.region
          metrics = [
            ["NexMart/Business", "CartItemsAdded"]
          ]
        }
      }

    ]
  })
}
