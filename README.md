# 🛒 Serverless E-Commerce Application

> A fully serverless, microservices-based e-commerce platform built on AWS —  
> featuring product management, cart handling, and order processing,  
> with infrastructure fully managed via Terraform.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Configure AWS](#configure-aws)
- [Backend Deployment](#backend-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Access Application](#access-application)
- [Testing](#testing)
- [Observability & Monitoring](#observability--monitoring)
- [API Design](#api-design)
- [Idempotency](#idempotency)
- [.gitignore](#gitignore)
- [Conclusion](#conclusion)

---

## 📖 Overview

This project is a cloud-native e-commerce application built entirely on a **serverless architecture** using AWS managed services. There are no traditional servers to manage — compute, storage, and content delivery all scale automatically with demand.

The backend is organized into three independent **microservices** (Product, Cart, and Order), each powered by AWS Lambda functions with dedicated DynamoDB tables. The frontend is a plain **HTML/CSS/JavaScript** application hosted on Amazon S3 and delivered globally via CloudFront.

All infrastructure is defined and deployed using **Terraform**, split into separate folders for backend and frontend concerns.

---

## 🏗️ Architecture

```
                         ┌──────────────────────────────┐
                         │            USER              │
                         └──────────────┬───────────────┘
                                        │  HTTPS
                                        ▼
                         ┌──────────────────────────────┐
                         │       Amazon CloudFront      │
                         │   (CDN · HTTPS · Caching)    │
                         └───────────┬──────────────────┘
                                     │
                 ┌───────────────────┴──────────────────┐
                 │                                      │
                 ▼                                      ▼
  ┌──────────────────────────┐          ┌───────────────────────────┐
  │     Amazon S3            │          │      API Gateway          │
  │  (HTML · CSS · JS)       │          │   (REST API Endpoints)    │
  └──────────────────────────┘          └───────────┬───────────────┘
                                                    │
                     ┌──────────────────────────────┼──────────────────────────────┐
                     │                              │                              │
                     ▼                              ▼                              ▼
       ┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
       │   Product Service   │      │    Cart Service      │      │   Order Service     │
       │    AWS Lambda       │      │    AWS Lambda        │      │    AWS Lambda       │
       └──────────┬──────────┘      └───────────┬──────────┘      └──────────┬──────────┘
                  │                             │                             │
                  ▼                             ▼                             ▼
       ┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
       │      DynamoDB       │      │      DynamoDB        │      │      DynamoDB       │
       │   Products Table    │      │     Cart Table       │      │    Orders Table     │
       └─────────────────────┘      └──────────────────────┘      └─────────────────────┘
                  │                             │                             │
                  └─────────────────────────────┼─────────────────────────────┘
                                                │
                                                ▼
                              ┌─────────────────────────────────┐
                              │        Monitoring Layer         │
                              │  CloudWatch · Lambda Monitor    │
                              │     SNS Alerts · Route 53       │
                              └─────────────────────────────────┘
```

---

## ✨ Features

| Feature | Description |
|---|---|
| **Product Catalog** | Full CRUD operations — create, read, update, delete products |
| **Cart Management** | Add, view, update, and remove cart items per user |
| **Order Processing** | Place orders and retrieve order history |
| **Serverless Compute** | Auto-scaling Lambda functions with no server management |
| **Global CDN** | Frontend delivered via CloudFront for low latency worldwide |
| **Infrastructure as Code** | Reproducible Terraform deployments for all AWS resources |
| **Monitoring & Alerts** | CloudWatch logs, Lambda health checks, and SNS notifications |
| **Unit Testing** | Jest-based tests for Lambda business logic |
| **Integration Testing** | Browser-based UI Test Panel for end-to-end API validation |

---

## 🛠️ Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| AWS Lambda | Serverless compute for all microservices |
| Amazon API Gateway | REST API routing and request handling |
| Amazon DynamoDB | NoSQL database for products, carts, and orders |
| Node.js | Lambda function runtime |
| Terraform | Backend infrastructure provisioning |

### Frontend

| Technology | Purpose |
|---|---|
| HTML5 / CSS3 / JavaScript | Plain frontend — no frameworks |
| Amazon S3 | Static file hosting |
| Amazon CloudFront | CDN, HTTPS termination, and caching |
| Terraform | Frontend infrastructure provisioning |

### Monitoring

| Technology | Purpose |
|---|---|
| Amazon CloudWatch | Logs, metrics, and dashboards |
| AWS Lambda Monitor | Custom scheduled API health check function |
| Amazon SNS | Email/SMS alert notifications |
| Amazon Route 53 | External DNS-level health checks |

---

## 📁 Project Structure

```
ecommerce-project/
│
├── eccommerce-terraform/          # Backend infrastructure
│   ├── product-service/          # Product Lambda function & config
│   ├── cart-service/             # Cart Lambda function & config
│   ├── order-service/            # Order Lambda function & config
│   ├── main.tf                   # Root backend module
│   ├── variable.tf               # Input variable definitions
│   ├── output.tf                 # Output values (API URL, table names)
│   ├── cloudwatch.tf             # CloudWatch log groups & alarms
│   └── lambda-monitor.tf         # Monitoring Lambda + SNS + Route 53
│
├── frontend-terraform/           # Frontend infrastructure
│   ├── index.html                # Main frontend application file
│   ├── main.tf                   # S3 bucket configuration
│   ├── cloudfront.tf             # CloudFront distribution
│   ├── variable.tf               # Frontend variables
│   └── output.tf                 # CloudFront URL output
│
├── .gitignore
└── README.md
```

---

## ✅ Prerequisites

Ensure the following tools are installed before getting started:

| Tool | Version | Purpose |
|---|---|---|
| [Node.js](https://nodejs.org/) | v18+ | Lambda runtime & local testing |
| [npm](https://www.npmjs.com/) | v9+ | Package management |
| [Terraform](https://developer.hashicorp.com/terraform/install) | v1.5+ | Infrastructure provisioning |
| [AWS CLI](https://aws.amazon.com/cli/) | v2+ | AWS authentication |
| AWS Account | — | Target cloud environment |

---

## ⚙️ Configure AWS

Configure the AWS CLI with your credentials before running any Terraform commands:

```bash
aws configure
```

You will be prompted for:

```
AWS Access Key ID:     <your-access-key-id>
AWS Secret Access Key: <your-secret-access-key>
Default region name:   us-east-1
Default output format: json
```

> 💡 Ensure your IAM user or role has permissions for: Lambda, API Gateway, DynamoDB, S3, CloudFront, CloudWatch, SNS, Route 53, and IAM role creation.

---

## 🚀 Backend Deployment

This deploys all Lambda functions, API Gateway, DynamoDB tables, and the monitoring stack.

**Step 1 — Navigate to the backend folder:**

```bash
cd eccommerce-terraform
```

**Step 2 — Initialize Terraform:**

```bash
terraform init
```

**Step 3 — Preview the resources to be created:**

```bash
terraform plan
```

**Step 4 — Deploy all backend resources:**

```bash
terraform apply
```

Type `yes` when prompted to confirm.

Once complete, Terraform will print your API Gateway URL:

```
Outputs:

api_gateway_url = "https://abc123.execute-api.us-east-1.amazonaws.com/prod"
```

> 📝 Save this URL — you will need it to configure the frontend.

---

## 🌐 Frontend Deployment

This creates the S3 bucket, uploads the frontend files, and provisions the CloudFront distribution.

**Step 1 — Update the API URL in the frontend:**

Before deploying, set the API Gateway URL from the previous step inside your frontend JavaScript:

```javascript
const API_BASE_URL = "https://abc123.execute-api.us-east-1.amazonaws.com/prod";
```

**Step 2 — Navigate to the frontend folder:**

```bash
cd ../frontend-terraform
```

**Step 3 — Initialize Terraform:**

```bash
terraform init
```

**Step 4 — Preview the resources:**

```bash
terraform plan
```

**Step 5 — Deploy frontend infrastructure:**

```bash
terraform apply
```

Type `yes` when prompted.

Terraform will output your CloudFront URL:

```
Outputs:

cloudfront_url = "https://d1234abcd.cloudfront.net"
```

---

## 🌍 Access Application

Once both deployments are complete, open the CloudFront URL in your browser:

```
https://d1234abcd.cloudfront.net
```

The application is now live and globally distributed. 🎉

### Tearing Down Resources

To remove all AWS resources and stop incurring charges:

```bash
# Destroy frontend first
cd frontend-terraform
terraform destroy

# Then destroy backend
cd ../ecommerce-terraform
terraform destroy
```

---

## 🧪 Testing

### Unit Tests — Jest

Unit tests validate each Lambda function's business logic in isolation, without making real AWS calls.

**Run all unit tests:**

```bash
npm test
```

**Run tests for a specific service:**

```bash
npx jest product.test.js
npx jest cart.test.js
npx jest order.test.js
```

**Run with coverage report:**

```bash
npm test -- --coverage
```

Expected output:

```
 PASS  product.test.js
 PASS  cart.test.js
 PASS  order.test.js

Test Suites: 3 passed, 3 total
Tests:       18 passed, 18 total
Coverage:    92%
```

---

### Integration Tests — UI Test Panel

The project includes a browser-based **UI Test Panel** for testing the live deployed API end-to-end.

**How to use:**

1. Deploy the backend (see [Backend Deployment](#backend-deployment)).
2. Open the Test Panel in your browser (available via CloudFront).
3. Enter your **API Gateway base URL** in the input field.
4. Click test buttons to run operations against each service:
   - Create, read, update, and delete products
   - Add and retrieve cart items
   - Place orders and view order history
5. HTTP response codes and results are displayed inline for each test.

> ⚠️ Integration tests run against real AWS resources. The backend must be deployed before running them.

---

## 📊 Observability & Monitoring

The application uses a four-layer monitoring strategy for reliability and fast incident response.

### CloudWatch Logs

Every Lambda invocation automatically writes structured logs to **Amazon CloudWatch**.

- Log groups follow the pattern: `/aws/lambda/<function-name>`
- Logs capture: invocation time, request payload, errors, and execution duration.

To view logs:

```
AWS Console → CloudWatch → Log Groups → /aws/lambda/product-service
```

### Lambda Monitor

A dedicated **monitoring Lambda** (defined in `lambda-monitor.tf`) runs on a scheduled CloudWatch Events rule. It:

1. Sends synthetic requests to each API endpoint.
2. Validates response status codes and payload structure.
3. Publishes a health metric to CloudWatch.
4. Triggers an SNS alert if any check fails.

### SNS Alerts

**Amazon SNS** sends notifications when:

- An API health check fails
- Lambda error rates exceed a defined threshold
- DynamoDB throttling events are detected

Subscribe your email to receive alerts after deployment:

```bash
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:123456789:ecommerce-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

### Route 53 Health Checks

**Amazon Route 53** performs external HTTP health checks against the API Gateway endpoint at regular intervals. If the endpoint becomes unreachable, Route 53 marks it unhealthy and triggers an SNS notification.

---

## 📡 API Design

All endpoints are exposed via **Amazon API Gateway** and routed to Lambda functions.

**Base URL:**

```
https://<api-id>.execute-api.<region>.amazonaws.com/prod
```

### Product Service

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `GET` | `/products` | List all products | `200 OK` |
| `GET` | `/products/{id}` | Get a product by ID | `200 OK` |
| `POST` | `/products` | Create a new product | `201 Created` |
| `PUT` | `/products/{id}` | Update a product | `200 OK` |
| `DELETE` | `/products/{id}` | Delete a product | `200 OK` |

### Cart Service

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `GET` | `/cart/{userId}` | Get cart items for a user | `200 OK` |
| `POST` | `/cart` | Add an item to the cart | `201 Created` |
| `PUT` | `/cart/{userId}/{productId}` | Update item quantity | `200 OK` |
| `DELETE` | `/cart/{userId}/{productId}` | Remove a cart item | `200 OK` |
| `DELETE` | `/cart/{userId}` | Clear the entire cart | `200 OK` |

### Order Service

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `GET` | `/orders/{userId}` | Get all orders for a user | `200 OK` |
| `GET` | `/orders/{userId}/{orderId}` | Get a specific order | `200 OK` |
| `POST` | `/orders` | Place a new order | `201 Created` |

### Standard Error Codes

| Status Code | Meaning |
|---|---|
| `400 Bad Request` | Invalid input or missing required fields |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Duplicate request detected (idempotency) |
| `500 Internal Server Error` | Unexpected Lambda or DynamoDB error |

---

## 🔁 Idempotency

Idempotency ensures that **duplicate API requests produce the same result without side effects** — critical for operations like order placement where network retries could cause duplicate records or charges.

### How It Works

1. The client generates a unique `idempotencyKey` (e.g., a UUID) for each mutating request.
2. The Lambda function checks DynamoDB for an existing record with that key.
3. **If the key exists** — the original response is returned immediately, no action is repeated.
4. **If the key is new** — the operation proceeds and the key is stored with a TTL for automatic expiry.

### Implementation Pattern

```javascript
const existing = await dynamoDB.get({ Key: { idempotencyKey } });

if (existing.Item) {
  // Duplicate — return cached response
  return { statusCode: 200, body: JSON.stringify(existing.Item.response) };
}

// New request — process and store result
const result = await processOrder(event);
await dynamoDB.put({
  Item: {
    idempotencyKey,
    response: result,
    ttl: Math.floor(Date.now() / 1000) + 86400  // 24-hour TTL
  }
});

return { statusCode: 201, body: JSON.stringify(result) };
```

### Where It Applies

| Endpoint | Idempotency Applied |
|---|---|
| `POST /orders` | ✅ Yes — prevents duplicate orders |
| `POST /cart` | ✅ Yes — prevents duplicate cart entries |
| `POST /products` | ✅ Yes — prevents duplicate product creation |
| `GET` requests | ➖ Not needed — reads are naturally idempotent |
| `DELETE` requests | ➖ Not needed — second delete returns `404` gracefully |

---

## 🚫 .gitignore

Add this `.gitignore` to the project root to avoid committing sensitive or generated files:

```gitignore
# Terraform state and local config
**/.terraform/
*.tfstate
*.tfstate.backup
*.tfvars
.terraform.lock.hcl

# Node.js
node_modules/
npm-debug.log*

# Lambda build artifacts
*.zip
dist/
build/

# AWS credentials — never commit these
.aws/
*.pem
*.key

# Environment files
.env
.env.local
.env.production

# OS files
.DS_Store
Thumbs.db

# Test coverage output
coverage/
```

> ⚠️ **Never commit `.tfstate` files or AWS credentials.** Use [Terraform remote state](https://developer.hashicorp.com/terraform/language/state/remote) (e.g., an S3 backend with DynamoDB locking) for team environments.

---

## 🏁 Conclusion

This project demonstrates a production-grade serverless e-commerce system built entirely on AWS managed services. By leveraging Lambda, DynamoDB, API Gateway, CloudFront, and S3, the application achieves:

| Quality | How |
|---|---|
| ⚡ **Scalability** | Lambda and DynamoDB scale automatically with zero configuration |
| 💰 **Cost Efficiency** | Pay only for actual usage — no idle server costs |
| 🔒 **Reliability** | Multi-layer monitoring with proactive alerting |
| 🔄 **Repeatability** | Full infrastructure defined in Terraform for consistent deployments |
| 🧪 **Confidence** | Unit and integration testing across all services |

This architecture serves as a solid foundation for real-world serverless applications and can be extended with features such as user authentication (Amazon Cognito), payment integration, or full-text product search.

---

<div align="center">

Built with ☁️ on AWS Serverless &nbsp;|&nbsp; Infrastructure by Terraform

</div>
