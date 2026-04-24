terraform {
  backend "s3" {
    bucket         = "ats-matcher-backend-tf-state"
    key            = "ats-matcher-backend/terraform.tfstate"
    region         = "eu-west-2"
    dynamodb_table = "terraform-locks"
  }
}