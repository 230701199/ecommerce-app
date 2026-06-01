# Terraform configuration has been split into modular files:
# - provider.tf: AWS provider and version requirements
# - iam.tf: IAM roles and policies
# - lambda.tf: Lambda functions and archive data sources
# - dynamodb.tf: DynamoDB tables
# - api-gateway.tf: API Gateway, integrations, routes, and stages
# - permissions.tf: Lambda invoke permissions
