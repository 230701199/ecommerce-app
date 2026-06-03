output "api_url" {
  description = "Base API Gateway URL"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "product_endpoint" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/products"
}

output "cart_endpoint" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/cart"
}

output "order_endpoint" {
  value = "${aws_apigatewayv2_api.api.api_endpoint}/orders"
}

output "sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}

# =============================================================================
# Observability outputs  (asif_ naming standard)
# =============================================================================

output "asif_dashboard_url" {
  description = "Direct link to the NexMart-Asif-Dashboard in CloudWatch."
  value       = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${aws_cloudwatch_dashboard.asif_nexmart.dashboard_name}"
}

output "asif_monitoring_topic_arn" {
  description = "ARN of the SNS topic that receives all CloudWatch alarm notifications."
  value       = aws_sns_topic.alerts.arn
}

output "asif_lambda_error_alarm_arns" {
  description = "ARNs of per-service Lambda error alarms (keyed by service)."
  value       = { for k, v in aws_cloudwatch_metric_alarm.asif_lambda_errors : k => v.arn }
}

output "asif_dynamo_throttle_alarm_arns" {
  description = "ARNs of per-table DynamoDB throttle alarms (keyed by logical table name)."
  value       = { for k, v in aws_cloudwatch_metric_alarm.asif_dynamo_throttles : k => v.arn }
}

output "asif_xray_tracing_modes" {
  description = "Confirms X-Ray Active tracing mode for all application Lambdas."
  value = {
    product = aws_lambda_function.product_service.tracing_config[0].mode
    cart    = aws_lambda_function.cart_service.tracing_config[0].mode
    order   = aws_lambda_function.order_service.tracing_config[0].mode
  }
}