resource "aws_lb" "alb" {
  name               = "${var.app_name}-alb"
  load_balancer_type = "application"
  subnets            = module.vpc.public_subnets
  security_groups    = [aws_security_group.alb.id]

  enable_deletion_protection = false

  tags = {
    Name = "${var.app_name}-alb"
  }
}

resource "aws_lb_target_group" "tg" {
  name        = "${var.app_name}-tg"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id

  lifecycle {
    create_before_destroy = true
  }

  # ✅ REQUIRED for Fargate
  target_type = "ip"

  health_check {
    path                = "/"          # or "/health" if you add endpoint
    port                = "traffic-port"
    protocol            = "HTTP"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${var.app_name}-tg"
  }
}

resource "aws_lb_listener" "listener" {
  load_balancer_arn = aws_lb.alb.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.tg.arn
  }
}