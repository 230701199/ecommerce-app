data "archive_file" "product_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../product-service"
  output_path = "${path.module}/../build/product-service.zip"
}

data "archive_file" "cart_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../cart-service"
  output_path = "${path.module}/../build/cart-service.zip"
}

data "archive_file" "order_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../order-service"
  output_path = "${path.module}/../build/order-service.zip"
}

resource "aws_lambda_function" "product_service" {
  function_name    = "${var.project_name}-product-service"
  filename         = data.archive_file.product_zip.output_path
  source_code_hash = data.archive_file.product_zip.output_base64sha256
  handler          = "src/server.handler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_exec_role.arn

  tracing_config {
    mode = "Active"
  }
}

resource "aws_lambda_function" "cart_service" {
  function_name    = "${var.project_name}-cart-service"
  filename         = data.archive_file.cart_zip.output_path
  source_code_hash = data.archive_file.cart_zip.output_base64sha256
  handler          = "src/server.handler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_exec_role.arn

  tracing_config {
    mode = "Active"
  }
}

resource "aws_lambda_function" "order_service" {
  function_name    = "${var.project_name}-order-service"
  filename         = data.archive_file.order_zip.output_path
  source_code_hash = data.archive_file.order_zip.output_base64sha256
  handler          = "src/server.handler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_exec_role.arn
  timeout          = 15

  tracing_config {
    mode = "Active"
  }
}
