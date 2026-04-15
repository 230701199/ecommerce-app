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
