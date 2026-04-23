resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/ecs/${var.app_name}"
  retention_in_days = 14
}