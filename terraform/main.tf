provider "aws" {
  region = var.aws_region
}

terraform {
  required_version = ">= 1.5.0"

  backend "s3" {
    bucket = "ats-matcher-backend-tf-state"
    key    = "ats-matcher/terraform.tfstate"
    region = "eu-west-2"
  }
}