terraform {
  backend "s3" {
    bucket = "atsmatcherv1"
    key    = "terraform/terraform.tfstate"
    region = "eu-west-2"
  }
}