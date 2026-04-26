resource "aws_ssm_parameter" "ecr_repo" {
  name  = "/${var.app_name}/ecr_repo"
  type  = "String"
  value = aws_ecr_repository.repo.repository_url
}

resource "aws_ssm_parameter" "ecs_cluster" {
  name  = "/${var.app_name}/ecs_cluster"
  type  = "String"
  value = aws_ecs_cluster.cluster.name
}

resource "aws_ssm_parameter" "ecs_service" {
  name  = "/${var.app_name}/ecs_service"
  type  = "String"
  value = aws_ecs_service.service.name
}