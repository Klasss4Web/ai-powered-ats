output "alb_dns_name" {
  description = "Public URL of the application"
  value       = aws_lb.alb.dns_name
}

output "ecr_repository_url" {
  description = "ECR repo URL for pushing images"
  value       = aws_ecr_repository.repo.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.cluster.name
}

output "ecs_service_name" {
  value = aws_ecs_service.service.name
}

output "db_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.postgres.address
}