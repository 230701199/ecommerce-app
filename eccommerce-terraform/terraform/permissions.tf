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
