# ==============================
# SNS (Email Notification)
# ==============================

resource "aws_sns_topic" "alerts" {
  name = "ecommerce-alerts"
}

resource "aws_sns_topic_subscription" "email_alert" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = "muhammad.asif@idp.com"   # 🔥 CHANGE THIS
}

# ==============================
# FRONTEND HEALTH CHECK (CloudFront)
# ==============================

resource "aws_route53_health_check" "frontend_health" {
  fqdn              = "d32cdbqdjix51o.cloudfront.net"   # 🔥 PUT YOUR CLOUD FRONT DOMAIN
  port              = 443
  type              = "HTTPS"
  resource_path     = "/"
  failure_threshold = 3
  request_interval  = 30
}

# ==============================
# BACKEND HEALTH CHECK (API)
# ==============================

resource "aws_route53_health_check" "api_products_health" {
  fqdn              = "5q15zd43h1.execute-api.ap-southeast-1.amazonaws.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/products"
  failure_threshold = 3
  request_interval  = 30
}

# OPTIONAL (RECOMMENDED) – MORE API CHECKS

resource "aws_route53_health_check" "api_cart_health" {
  fqdn              = "5q15zd43h1.execute-api.ap-southeast-1.amazonaws.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/cart/test-user"
  failure_threshold = 3
  request_interval  = 30
}

resource "aws_route53_health_check" "api_orders_health" {
  fqdn              = "5q15zd43h1.execute-api.ap-southeast-1.amazonaws.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/orders/test-user"
  failure_threshold = 3
  request_interval  = 30
}