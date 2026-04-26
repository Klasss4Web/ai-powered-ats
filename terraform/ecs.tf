resource "aws_ecs_cluster" "cluster" {
  name = "${var.app_name}-cluster"
}

resource "aws_cloudwatch_log_group" "logs" {
  name              = "/ecs/${var.app_name}"
  retention_in_days = 7
}

resource "aws_ecs_task_definition" "task" {
  family                   = "${var.app_name}-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  cpu    = "512"
  memory = "1024"

  execution_role_arn = aws_iam_role.ecs_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "flask"
    image = "${aws_ecr_repository.repo.repository_url}:latest"

    portMappings = [{
      containerPort = 5000
      hostPort      = 5000
    }]


    environment = [
      {
        name  = "DATABASE_URL"
        value = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.address}:5432/appdb"
      },

      {
        name  = "OPENAI_API_KEY"
        value = "${var.openai_api_key}"
      },
      {
        name  = "OPENROUTER_API_KEY"
        value = "${var.openrouter_api_key}"
      },
      {
        name  = "PAYSTACK_SECRET_KEY"
        value = "${var.paystack_secret_key}"
      },
      {
        name  = "PAYSTACK_PK_KEY"
        value = "${var.paystack_pk_key}"
      },
      {
        name  = "PAYSTACK_CALLBACK_URL"
        value = "${var.paystack_callback_url}"
      },

      {
        name  = "PAYPAL_CLIENT_ID"
        value = "${var.paypal_client_id}"
      },
      {
        name  = "PAYPAL_CLIENT_SECRET"
        value = "${var.paypal_secret_key}"
      },

      {
        name  = "JWT_SECRET_KEY"
        value = "${var.jwt_secret_key}"
      }
      
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.logs.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "service" {
  name            = "${var.app_name}-service"
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.task.arn
  desired_count   = 1

  launch_type = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.app.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.tg.arn
    container_name   = "flask"
    container_port   = 5000
  }

  depends_on = [aws_lb_listener.listener]
}