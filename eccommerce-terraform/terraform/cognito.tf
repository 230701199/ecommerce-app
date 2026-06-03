resource "aws_cognito_user_pool" "main" {
  name                     = "asif_user"
  deletion_protection      = "ACTIVE"
  mfa_configuration        = "OFF"
  auto_verified_attributes = ["email"]
  username_attributes      = ["email"]

  username_configuration {
    case_sensitive = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  password_policy {
    minimum_length                   = 8
    password_history_size            = 0
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }

    recovery_mechanism {
      name     = "verified_phone_number"
      priority = 2
    }
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
  }

  sign_in_policy {
    allowed_first_auth_factors = ["PASSWORD"]
  }

  schema {
    name                     = "email"
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    required                 = true

    string_attribute_constraints {
      min_length = "0"
      max_length = "2048"
    }
  }
}

resource "aws_cognito_user_pool_client" "frontend" {
  name         = "asif_userpool"
  user_pool_id = aws_cognito_user_pool.main.id

  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 5
  auth_session_validity  = 3

  callback_urls = [
    "https://d32dvut05ll57l.cloudfront.net"
  ]

  logout_urls = [
    "https://d32dvut05ll57l.cloudfront.net"
  ]

  default_redirect_uri = "https://d32dvut05ll57l.cloudfront.net"

  allowed_oauth_flows = [
    "code"
  ]

  allowed_oauth_scopes = [
    "email",
    "openid",
    "phone",
    "profile"
  ]

  allowed_oauth_flows_user_pool_client = true

  explicit_auth_flows = [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  supported_identity_providers = [
    "COGNITO"
  ]

  enable_token_revocation                   = true
  enable_propagate_additional_user_context_data = false
  prevent_user_existence_errors             = "ENABLED"

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}

resource "aws_cognito_user_pool_domain" "domain" {
  domain                = "ap-southeast-1pwak67usw"
  user_pool_id          = aws_cognito_user_pool.main.id
  managed_login_version = 2
}

resource "aws_cognito_user_group" "admin" {
  name         = "admin"
  precedence   = 0
  user_pool_id = aws_cognito_user_pool.main.id
}