# Lambda Role
resource "aws_iam_role" "lambda_role" {
  name = "lambda-monitor-role"

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

# Role Policy
resource "aws_iam_role_policy" "lambda_policy" {
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = ["sns:Publish"]
        Effect = "Allow"
        Resource = "*"
      },
      {
        Action = ["logs:*"]
        Effect = "Allow"
        Resource = "*"
      }
    ]
  })
}

# Lambda Function
resource "aws_lambda_function" "monitor" {
  function_name = "api-monitor"

  runtime = "nodejs18.x"
  handler = "lambda-monitor.handler"

  filename         = "lambda-monitor.zip"
  source_code_hash = filebase64sha256("lambda-monitor.zip")

  role = aws_iam_role.lambda_role.arn
}