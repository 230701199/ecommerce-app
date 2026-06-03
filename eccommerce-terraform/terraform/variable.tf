variable "region" {
  default = "ap-southeast-1"
}

variable "aws_profile" {
  default = "idp-sbx-trn-lab-01"
}

variable "project_name" {
  default = "terraform-asif"
}

variable "product_zip" {
  default = "product-service.zip"
}

variable "cart_zip" {
  default = "cart-service.zip"
}

variable "order_zip" {
  default = "order-service.zip"
}

# =============================================================================
# Observability variables
# =============================================================================

variable "alert_email" {
  description = "Email address to receive CloudWatch alarm notifications via SNS. Leave empty to skip creating a second subscription (monitor.tf already has one hard-coded)."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention period (days) for all Lambda log groups."
  type        = number
  default     = 30
}

variable "lambda_error_threshold" {
  description = "Number of Lambda errors per minute that triggers an alarm."
  type        = number
  default     = 1
}

variable "lambda_duration_threshold_ms" {
  description = "Lambda p99 duration (ms) that triggers an alarm."
  type        = number
  default     = 5000
}

variable "lambda_throttle_threshold" {
  description = "Number of Lambda throttles per minute that triggers an alarm."
  type        = number
  default     = 0
}

variable "apigw_4xx_threshold" {
  description = "Number of API Gateway 4XX errors per minute that triggers an alarm."
  type        = number
  default     = 10
}

variable "apigw_5xx_threshold" {
  description = "Number of API Gateway 5XX errors per minute that triggers an alarm."
  type        = number
  default     = 1
}

variable "apigw_latency_threshold_ms" {
  description = "API Gateway p99 integration latency (ms) that triggers an alarm."
  type        = number
  default     = 3000
}

variable "dynamo_throttle_threshold" {
  description = "Number of DynamoDB throttled requests per minute that triggers an alarm."
  type        = number
  default     = 0
}

# ── CloudFront observability ──────────────────────────────────────────────────

variable "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution serving the NexMart frontend (d32dvut05ll57l.cloudfront.net). Managed in a separate Terraform state; referenced here by ID only."
  type        = string
  default     = "E31INVU26UD3MB"
}

variable "cloudfront_5xx_threshold_pct" {
  description = "CloudFront 5XX error rate percentage that triggers an alarm."
  type        = number
  default     = 1
}

variable "cloudfront_4xx_threshold_pct" {
  description = "CloudFront 4XX error rate percentage that triggers an alarm."
  type        = number
  default     = 5
}