# ATS Matcher Backend Infrastructure
# Terraform configuration for deploying Flask backend to AWS ECS

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Add backend configuration for state management
  backend "s3" {
    # Configure these values according to your setup
    # bucket = "your-terraform-state-bucket"
    # key    = "ats-matcher/terraform.tfstate"
    # region = "eu-west-2"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.app_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data source for current AWS region
data "aws_region" "current" {}

# Data source for available availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Local values
locals {
  az_count = 2
  azs      = slice(data.aws_availability_zones.available.names, 0, local.az_count)
}