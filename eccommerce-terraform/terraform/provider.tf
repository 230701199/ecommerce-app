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

# CloudFront metrics live exclusively in us-east-1 regardless of where
# the rest of the stack is deployed. This alias is used only by the two
# CloudFront CloudWatch alarms in cloudwatch.tf.
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = "idp-sbx-trn-lab-01"
}
