# ----------------------------
# DB Security Group (ONLY ECS can access)
# ----------------------------
resource "aws_security_group" "db" {
  name   = "${var.app_name}-db-sg"
  vpc_id = module.vpc.vpc_id

  # Allow ONLY ECS tasks to access Postgres
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # Allow outbound traffic (updates, AWS services, etc.)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ----------------------------
# DB Subnet Group
# ----------------------------
resource "aws_db_subnet_group" "db" {
  name       = "${var.app_name}-db-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = {
    Name = "${var.app_name}-db-subnet-group"
  }
}

# ----------------------------
# ECS Application Security Group
# ----------------------------
resource "aws_security_group" "app" {
  name   = "${var.app_name}-app-sg"
  vpc_id = module.vpc.vpc_id

  # Allow traffic ONLY from ALB (NOT public internet)
  ingress {
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Allow outbound traffic (DB, AWS APIs, internet updates)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ----------------------------
# ALB Security Group (Public entry point)
# ----------------------------
resource "aws_security_group" "alb" {
  name   = "${var.app_name}-alb-sg"
  vpc_id = module.vpc.vpc_id

  # HTTP access from internet
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS access from internet (optional but recommended)
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # ALB must be able to talk to ECS
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}