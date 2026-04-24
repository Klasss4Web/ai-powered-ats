# AWS Secrets Manager for sensitive configuration
resource "aws_secretsmanager_secret" "jwt_secret" {
  name                    = "${var.app_name}/jwt-secret-key"
  description             = "JWT Secret Key for authentication"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.app_name}-jwt-secret"
  }
}

resource "aws_secretsmanager_secret" "gemini_api_key" {
  name                    = "${var.app_name}/gemini-api-key"
  description             = "Google Gemini API Key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.app_name}-gemini-api-key"
  }
}

resource "aws_secretsmanager_secret" "paystack_secret" {
  name                    = "${var.app_name}/paystack-secret-key"
  description             = "Paystack Secret Key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.app_name}-paystack-secret"
  }
}

resource "aws_secretsmanager_secret" "paystack_pk" {
  name                    = "${var.app_name}/paystack-pk-key"
  description             = "Paystack Public Key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.app_name}-paystack-pk"
  }
}

resource "aws_secretsmanager_secret" "paypal_client_id" {
  name                    = "${var.app_name}/paypal-client-id"
  description             = "PayPal Client ID"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.app_name}-paypal-client-id"
  }
}

resource "aws_secretsmanager_secret" "paypal_client_secret" {
  name                    = "${var.app_name}/paypal-client-secret"
  description             = "PayPal Client Secret"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.app_name}-paypal-client-secret"
  }
}