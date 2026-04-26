variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "eu-west-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "ats-matcher-backend"
}

variable "db_username" {
  description = "Database username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "ats_matcher"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 5000
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "cpu" {
  description = "ECS task CPU units"
  type        = number
  default     = 256
}

variable "memory" {
  description = "ECS task memory"
  type        = number
  default     = 512
}

variable "health_check_path" {
  description = "Health check path"
  type        = string
  default     = "/health"
}

# OpenAI API key for tracing (required for OpenAI Agents SDK tracing)
variable "openai_api_key" {
  description = "OpenAI API key for enabling tracing in OpenAI Agents SDK"
  type        = string
  default     = ""
  sensitive   = true
}

variable "jwt_secret_key" {
  description = "JWT secret key for authentication and authorization"
  type        = string
  default     = ""
  sensitive   = true
}

variable "openrouter_api_key" {
  description = "Openrouter api key for calling llm end points"
  type        = string
  default     = ""
  sensitive   = true
}

variable "paystack_secret_key" {
  description = "paystack secret api key for verifying paystack public key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "paystack_pk_key" {
  description = "paystack public api key for calling paystack payment gateway"
  type        = string
  default     = ""
  sensitive   = true
}

variable "paypal_client_id" {
  description = "paypal client id for identifying paypal client by paypal"
  type        = string
  default     = ""
  sensitive   = true
}

variable "paypal_secret_key" {
  description = "paypal client secret key for calling paypal paypal"
  type        = string
  default     = ""
  sensitive   = true
}

# Update after frontend deployment to deployment url
variable "frontend_url" {
  description = "paypal client secret key for calling paypal paypal"
  type        = string
  default     = "https://ats-tracker-git-master-ochade-emmanuels-projects.vercel.app"
  sensitive   = false
}

variable "paystack_callback_url" {
  description = "paypal client secret key for calling paypal paypal"
  type        = string
  default     = "https://ats-tracker-git-master-ochade-emmanuels-projects.vercel.app/matcher"
  sensitive   = false
}

