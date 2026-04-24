resource "aws_db_instance" "postgres" {
  identifier        = lower("${var.app_name}-db")
  engine            = "postgres"
  engine_version    = "15"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  db_name  = "atsmatcher"
  username = var.db_username
  password = var.db_password
  port       = 5432

  skip_final_snapshot = true

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.db.name
}