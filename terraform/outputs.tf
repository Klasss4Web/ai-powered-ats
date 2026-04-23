output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "debug_app_name" {
  value = var.app_name
}

output "backend_url" {
  value = "http://${aws_lb.app.dns_name}"
}