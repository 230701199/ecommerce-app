provider "aws" {
  region  = "ap-southeast-1"
  profile = "idp-sbx-trn-lab-01"
}

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "frontend" {
  bucket = "terraform-asif-frontend-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_object" "index" {
  bucket       = aws_s3_bucket.frontend.id
  key          = "index.html"
  source       = "${path.root}/../frontend/index.html"
  content_type = "text/html"

  etag = filemd5("${path.root}/../frontend/index.html")
}

resource "aws_s3_object" "css" {
  bucket       = aws_s3_bucket.frontend.id
  key          = "styles.css"
  source       = "${path.root}/../frontend/styles.css"
  content_type = "text/css"

  etag = filemd5("${path.root}/../frontend/styles.css")
}

resource "aws_s3_object" "js" {
  bucket       = aws_s3_bucket.frontend.id
  key          = "app.js"
  source       = "${path.root}/../frontend/app.js"
  content_type = "application/javascript"

  etag = filemd5("${path.root}/../frontend/app.js")
}

resource "aws_s3_bucket_policy" "cloudfront_access" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"

        Principal = {
          Service = "cloudfront.amazonaws.com"
        }

        Action = "s3:GetObject"

        Resource = "${aws_s3_bucket.frontend.arn}/*"

        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend_cdn.arn
          }
        }
      }
    ]
  })
}