variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "eu-west-2"
}
variable "app_name" {}
variable "db_username" {}
variable "db_password" {}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}