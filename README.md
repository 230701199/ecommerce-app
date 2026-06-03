# NexMart – Serverless E-Commerce Platform

[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)](https://aws.amazon.com/serverless/)
[![Terraform](https://img.shields.io/badge/Terraform-Infrastructure%20as%20Code-blue)](https://www.terraform.io/)
[![Cognito](https://img.shields.io/badge/Cognito-Authentication-blueviolet)](https://aws.amazon.com/cognito/)

> NexMart is a cloud-native serverless e-commerce platform built on AWS. Backend and frontend infrastructure are managed independently as separate Terraform projects.

---

## 🌐 Live Demo

| Service | Endpoint |
|---|---|
| Frontend | https://d32dvut05ll57l.cloudfront.net/ |
| API Gateway | https://o8kqf93jnf.execute-api.ap-southeast-1.amazonaws.com |

---

## 📖 Overview

NexMart is a serverless e-commerce application designed as a portfolio-ready AWS showcase.

- Fully serverless backend using AWS Lambda, API Gateway, and DynamoDB
- Static frontend hosted on Amazon S3 and delivered with Amazon CloudFront
- Secure authentication with Amazon Cognito
- Observability using CloudWatch dashboards, alarms, SNS, and X-Ray
- Infrastructure as Code using separate Terraform projects for frontend and backend

This repository contains two independent Terraform deployments with separate state files:

1. `eccommerce-terraform/terraform` — backend infrastructure
2. `frontend-terraform/terraform` — frontend infrastructure

---

## 🏗️ Architecture

```
                 User
                   │
                   ▼
            Amazon CloudFront
                   │
      ┌────────────┴────────────┐
      │                         │
      ▼                         ▼
   Amazon S3               Amazon API Gateway
      │                         │
      ▼                         ▼
 Static frontend           AWS Lambda services
                              │   │   │
                              ▼   ▼   ▼
                      DynamoDB tables (Products, Cart, Orders)
                              │
                              ▼
                       CloudWatch / SNS / X-Ray
```

### Key architecture layers

- **Frontend**: HTML, CSS, JavaScript served from S3 + CloudFront
- **Authentication**: Cognito User Pool, App Client, and admin group
- **Backend**: API Gateway HTTP API routing to Lambda functions
- **Database**: DynamoDB tables for product catalog, cart state, and orders
- **Observability**: CloudWatch dashboards and alarms, SNS notifications, X-Ray tracing

---

## ✨ Features

### Customer Features

- User registration and login
- Email verification flow
- Browse products and filter by category
- Add products to cart
- Update cart quantity and remove items
- Place orders
- View order history
- Secure authentication with JWT tokens

### Admin Features

- Admin user group authorization via Cognito
- Create new products
- Update product details
- Delete products
- Product management UI in the storefront

---

## 🧩 AWS Services Used

| Service | Purpose |
|---|---|
| Amazon Cognito | User authentication, registration, verification, and groups |
| Amazon API Gateway | HTTP API proxy to Lambda backend services |
| AWS Lambda | Serverless business logic for products, cart, and orders |
| Amazon DynamoDB | NoSQL backend for products, carts, and order history |
| Amazon S3 | Storage of static frontend files |
| Amazon CloudFront | Global CDN, HTTPS, and caching |
| Amazon CloudWatch | Metrics, dashboards, and alarms for observability |
| Amazon SNS | Notification delivery for alarm alerts |
| AWS X-Ray | Distributed tracing for Lambda execution |
| AWS IAM | Role-based permissions for Lambda and infrastructure |

---

## 🔐 Security Implementation

NexMart uses AWS native security patterns:

- **JWT Authentication** using Cognito ID tokens
- **Cognito User Pool** for secure account management
- **Cognito User Groups** for admin authorization
- **Custom authentication pages** rather than Hosted UI
- **HTTPS delivery** through CloudFront
- **IAM least privilege** for Lambda execution and DynamoDB access
- **Token-based API access** for secure frontend/backend communication

---

## 📊 Observability & Monitoring

Monitoring is implemented using CloudWatch, SNS, and X-Ray.

### CloudWatch Dashboard

The dashboard tracks:

- API Gateway requests, 4XX, 5XX, and latency
- Lambda invocations, errors, duration, and throttles
- DynamoDB read/write consumption and throttles
- CloudFront metrics via distribution ID reference
- Custom business metrics in `NexMart/Business`

### CloudWatch Alarms

Configured alarms include:

- Lambda Errors
- Lambda Duration (p99)
- Lambda Throttles
- API Gateway 4XX Errors
- API Gateway 5XX Errors
- API Gateway Integration Latency
- DynamoDB Throttled Requests
- DynamoDB System Errors

### Notifications

- SNS topic `ecommerce-alerts` for alarm notifications
- Email subscription configured in backend Terraform

### Tracing

- AWS X-Ray enabled for backend Lambda functions
- Active tracing configured in `lambda.tf`

### Business Metrics

Custom metrics published to CloudWatch:

- `OrdersPlaced`
- `ProductsCreated`
- `CartItemsAdded`

---

## 🗄️ Database Design

The backend uses three DynamoDB tables:

| Table | Name | Keys | Purpose |
|---|---|---|---|
| Products | `asif-products` | `id` (Number) | Stores product catalog entries |
| Cart | `asif-cart` | `userId` (String), `productId` (String) | Stores per-user cart items |
| Orders | `asif-order` | `orderId` (String) | Persists order history entries |

All tables use **PAY_PER_REQUEST** billing mode for serverless scaling.

---

## ⚙️ Infrastructure as Code

This repository is intentionally split into two independent Terraform deployments.

### Backend Terraform Project

Location: `eccommerce-terraform/terraform`

Includes:

- `provider.tf` — AWS provider configuration and archive provider
- `lambda.tf` — Lambda functions, archive packaging, and tracing
- `dynamodb.tf` — DynamoDB table definitions
- `api-gateway.tf` — API Gateway HTTP API, integrations, and routes
- `cognito.tf` — Cognito User Pool, App Client, User Pool domain, and admin group
- `iam.tf` — Lambda IAM role and managed policy attachments
- `permissions.tf` — Lambda invoke permissions for API Gateway
- `monitor.tf` — SNS topic and Route 53 health checks
- `lambda-monitor.tf` — monitoring Lambda and its IAM role
- `cloudwatch.tf` — CloudWatch dashboard, alarms, and alarm actions
- `variable.tf` — input variables, thresholds, and CloudFront references
- `output.tf` — backend endpoints, dashboard, and alarm ARNs

### Frontend Terraform Project

Location: `frontend-terraform/terraform`

Includes:

- `main.tf` — S3 bucket, object uploads, public access block, and bucket policy
- `cloudfront.tf` — CloudFront distribution with Origin Access Control (OAC)
- `output.tf` — frontend bucket name and CloudFront domain

This separation reflects independent state management for frontend and backend.

---

## 📁 Project Structure

```
ecommerce-app/
├── eccommerce-terraform/
│   ├── product-service/
│   ├── cart-service/
│   ├── order-service/
│   ├── build/
│   ├── business-metrics.js
│   └── terraform/
│       ├── api-gateway.tf
│       ├── cloudwatch.tf
│       ├── cognito.tf
│       ├── iam.tf
│       ├── lambda-monitor.tf
│       ├── lambda.tf
│       ├── main.tf
│       ├── monitor.tf
│       ├── output.tf
│       ├── permissions.tf
│       ├── provider.tf
│       ├── variable.tf
│       ├── dynamodb.tf
│       └── terraform.tfstate
├── frontend-terraform/
│   ├── frontend/
│   │   ├── index.html
│   │   ├── login.html
│   │   ├── signup.html
│   │   ├── verify.html
│   │   ├── app.js
│   │   ├── auth.js
│   │   ├── styles.css
│   │   └── auth.css
│   └── terraform/
│       ├── cloudfront.tf
│       ├── main.tf
│       ├── output.tf
│       ├── variable.tf
│       └── terraform.tfstate
├── smoke-test.sh
├── package.json
├── package-lock.json
└── README.md
```

---

## 🚀 Deployment

### Backend Deployment

```bash
cd eccommerce-terraform/terraform
terraform init
terraform validate
terraform plan
terraform apply
```

### Frontend Deployment

```bash
cd frontend-terraform/terraform
terraform init
terraform validate
terraform plan
terraform apply
```

> Each Terraform project is deployed independently, using separate state files for frontend and backend.

---

## 📄 Application Pages

The frontend assets include:

- `index.html` — main storefront and shopping experience
- `login.html` — custom sign-in page
- `signup.html` — user registration page
- `verify.html` — email verification page
- `app.js` — product, cart, and order UI logic
- `auth.js` — custom Cognito authentication flow
- `styles.css` — storefront styling
- `auth.css` — auth page styling

---

## 🖼️ Screenshots

> Replace these placeholders with your actual screenshot files.

- `screenshots/home-page.png` — Home Page
- `screenshots/login-page.png` — Login Page
- `screenshots/signup-page.png` — Signup Page
- `screenshots/verify-page.png` — Email Verification Page
- `screenshots/product-catalog.png` — Product Catalog
- `screenshots/shopping-cart.png` — Shopping Cart
- `screenshots/order-history.png` — Order History
- `screenshots/admin-dashboard.png` — Admin Product Management
- `screenshots/cognito-user-pool.png` — Cognito User Pool
- `screenshots/cloudwatch-dashboard.png` — CloudWatch Dashboard
- `screenshots/terraform-apply.png` — Terraform Apply Output

---

## 🧠 Challenges & Learnings

This project highlights:

- Building a fully serverless AWS application
- Implementing Cognito authentication without the Hosted UI
- Managing admin authorization with Cognito user groups
- Integrating CloudFront with S3 and Origin Access Control
- Building observability using CloudWatch dashboards, alarms, SNS, and X-Ray
- Managing separate Terraform states for frontend and backend

---

## 🌱 Future Enhancements

Potential improvements:

- CI/CD pipeline for Terraform and frontend deployment
- Custom domain and HTTPS with AWS Certificate Manager
- AWS WAF for application security
- Multi-region deployment for resilience
- Payment gateway integration
- Advanced analytics and business intelligence dashboards

---

## 📌 Notes

NexMart is intentionally designed as two separate Terraform projects:

- `eccommerce-terraform/terraform` for backend resources
- `frontend-terraform/terraform` for frontend hosting

These projects should be managed separately and do not share a single Terraform state.
