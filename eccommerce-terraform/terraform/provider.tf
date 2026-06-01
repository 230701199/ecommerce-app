terraform {
  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region  = "ap-southeast-1"
  profile = "idp-sbx-trn-lab-01"
}
