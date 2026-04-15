provider "aws" {
  region  = "ap-southeast-1"
  profile = "idp-sbx-trn-lab-01"
}

# ---------------- IAM ROLE ----------------
resource "aws_iam_role" "lambda_exec_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "dynamodb_access" {
  role       = aws_iam_role.lambda_exec_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

# ---------------- LAMBDA ----------------
resource "aws_lambda_function" "product_service" {
  function_name = "${var.project_name}-product-service"
  filename      = var.product_zip
  handler       = "src/server.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn
  source_code_hash = filebase64sha256(var.product_zip)
}

resource "aws_lambda_function" "cart_service" {
  function_name = "${var.project_name}-cart-service"
  filename      = var.cart_zip
  handler       = "src/server.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn
  source_code_hash = filebase64sha256(var.cart_zip)
}

resource "aws_lambda_function" "order_service" {
  function_name = "${var.project_name}-order-service"
  filename      = var.order_zip
  handler       = "src/server.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec_role.arn
  source_code_hash = filebase64sha256(var.order_zip)
  timeout = 15 
}

# ---------------- API GATEWAY ----------------
resource "aws_apigatewayv2_api" "api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
  }
}
# ---------------- DYNAMODB ----------------

resource "aws_dynamodb_table" "products" {
  name         = "asif-products"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "N"
  }
}

resource "aws_dynamodb_table" "cart" {
  name         = "asif-cart"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "productId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "productId"
    type = "S"
  }
}

resource "aws_dynamodb_table" "orders" {
  name         = "asif-order"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "orderId"

  attribute {
    name = "orderId"
    type = "S"
  }
}

# ---------------- INTEGRATIONS ----------------
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

# ---------------- ROUTES ----------------

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
# ---------------- STAGE ----------------
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

# ---------------- PERMISSIONS ----------------
resource "aws_lambda_permission" "product" {
  statement_id  = "AllowProductInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.product_service.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_lambda_permission" "cart" {
  statement_id  = "AllowCartInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cart_service.function_name
  principal     = "apigateway.amazonaws.com"
}

resource "aws_lambda_permission" "order" {
  statement_id  = "AllowOrderInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.order_service.function_name
  principal     = "apigateway.amazonaws.com"
}