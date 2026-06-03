# IAM ROLE
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

# Allow Lambda functions to publish custom business metrics to CloudWatch.
# Scoped to the NexMart/Business namespace to follow least-privilege.
resource "aws_iam_role_policy" "lambda_custom_metrics" {
  name = "${var.project_name}-lambda-custom-metrics"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowBusinessMetrics"
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData"]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "NexMart/Business"
          }
        }
      }
    ]
  })
}

# Allow Lambda functions to look up Cognito user details (AdminGetUser)
resource "aws_iam_role_policy" "lambda_cognito_admin_get_user" {
  name = "${var.project_name}-lambda-cognito-admin-get-user"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowCognitoAdminGetUser"
        Effect   = "Allow"
        Action   = ["cognito-idp:AdminGetUser"]
        Resource = aws_cognito_user_pool.main.arn
      }
    ]
  })
}
