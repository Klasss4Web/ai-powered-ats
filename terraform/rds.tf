resource "aws_db_subnet_group" "db" {
  name       = "${var.app_name}-db-subnet"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "${var.app_name}-db-subnet"
  }
}

resource "aws_db_subnet_group" "public" {
  name       = "${var.app_name}-db-public"
  subnet_ids = module.vpc.public_subnets
}

resource "aws_db_instance" "postgres" {
  identifier        = "${var.app_name}-db"
  engine            = "postgres"
  instance_class    = "db.t3.micro"
  allocated_storage = 20

  db_name  = "appdb"
  # username = "atsmatcher"
  username = var.db_username
  password = var.db_password

  publicly_accessible = true
  vpc_security_group_ids = [aws_security_group.db.id]
  # db_subnet_group_name   = aws_db_subnet_group.db.name
  db_subnet_group_name = aws_db_subnet_group.public.name

  backup_retention_period = 0


  skip_final_snapshot = true
}