resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
  }
}

resource "aws_apigatewayv2_integration" "product" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.product_service.invoke_arn
}

resource "aws_apigatewayv2_integration" "cart" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.cart_service.invoke_arn
}

resource "aws_apigatewayv2_integration" "order" {
  api_id           = aws_apigatewayv2_api.api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.order_service.invoke_arn
}

# Products
resource "aws_apigatewayv2_route" "products" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /products"
  target    = "integrations/${aws_apigatewayv2_integration.product.id}"
}

# 🔥 IMPORTANT FIX (for /products/:id)
resource "aws_apigatewayv2_route" "products_with_id" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /products/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.product.id}"
}

# Cart
resource "aws_apigatewayv2_route" "cart" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /cart"
  target    = "integrations/${aws_apigatewayv2_integration.cart.id}"
}

# 🔥 IMPORTANT FIX (for /cart/u7)
resource "aws_apigatewayv2_route" "cart_with_id" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /cart/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.cart.id}"
}

# Orders
resource "aws_apigatewayv2_route" "orders" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /orders"
  target    = "integrations/${aws_apigatewayv2_integration.order.id}"
}

resource "aws_apigatewayv2_route" "orders_with_id" {
  api_id    = aws_apigatewayv2_api.api.id
  route_key = "ANY /orders/{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.order.id}"
}

# Admin Orders
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "CognitoAuthorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.frontend.id]
    issuer   = "https://${aws_cognito_user_pool.main.endpoint}"
  }
}

resource "aws_apigatewayv2_route" "admin_orders" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "GET /admin/orders"
  target             = "integrations/${aws_apigatewayv2_integration.order.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "admin_orders_status" {
  api_id             = aws_apigatewayv2_api.api.id
  route_key          = "PUT /admin/orders/{orderId}/status"
  target             = "integrations/${aws_apigatewayv2_integration.order.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}
