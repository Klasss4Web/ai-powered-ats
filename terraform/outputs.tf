# Terraform Outputs

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "ECR Repository URL"
  value       = aws_ecr_repository.main.repository_url
}

output "ecs_cluster_name" {
  description = "ECS Cluster Name"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS Service Name"
  value       = aws_ecs_service.main.name
}

output "rds_endpoint" {
  description = "RDS Database Endpoint"
  value       = aws_db_instance.main.endpoint
}

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnets" {
  description = "Public Subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnets" {
  description = "Private Subnet IDs"
  value       = aws_subnet.private[*].id
}

output "secrets_arns" {
  description = "Secrets Manager ARNs"
  value = {
    jwt_secret           = aws_secretsmanager_secret.jwt_secret.arn
    gemini_api_key       = aws_secretsmanager_secret.gemini_api_key.arn
    paystack_secret      = aws_secretsmanager_secret.paystack_secret.arn
    paystack_pk          = aws_secretsmanager_secret.paystack_pk.arn
    paypal_client_id     = aws_secretsmanager_secret.paypal_client_id.arn
    paypal_client_secret = aws_secretsmanager_secret.paypal_client_secret.arn
  }
  sensitive = true
}