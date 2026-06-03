<div align="center">

# 🛒 NexMart

### Cloud-Native Serverless E-Commerce Platform

[![AWS](https://img.shields.io/badge/AWS-Cloud-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Terraform](https://img.shields.io/badge/Terraform-IaC-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)](https://www.terraform.io/)
[![Serverless](https://img.shields.io/badge/Architecture-Serverless-FD5750?style=for-the-badge)](https://aws.amazon.com/lambda/)
[![DynamoDB](https://img.shields.io/badge/Database-DynamoDB-4053D6?style=for-the-badge&logo=amazondynamodb&logoColor=white)](https://aws.amazon.com/dynamodb/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

*A production-grade, fully serverless, microservices-based e-commerce platform built on AWS — designed for scale, security, and observability.*

</div>

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Business Problem](#-business-problem)
- [Architecture Diagrams](#️-architecture-diagrams)
  - [High-Level Architecture](#high-level-system-architecture)
  - [Authentication Flow](#authentication--authorization-flow)
  - [Service Architecture](#microservices-architecture)
- [AWS Services Used](#-aws-services-used)
- [Features](#-features)
  - [Customer Features](#customer-features)
  - [Admin Features](#admin-features)
- [Security Architecture](#-security-architecture)
  - [Cognito Authentication & Authorization](#cognito-authentication--authorization)
  - [JWT Flow](#jwt-token-flow)
- [API Documentation](#-api-documentation)
- [DynamoDB Design](#️-dynamodb-design)
- [Observability & Monitoring](#-observability--monitoring)
- [Infrastructure as Code](#️-infrastructure-as-code)
  - [Terraform Project Structure](#terraform-project-structure)
  - [Deployment Steps](#deployment-steps)
- [Testing Strategy](#-testing-strategy)
- [Challenges & Learnings](#-challenges--learnings)
- [Future Enhancements](#-future-enhancements)
- [Screenshots](#-screenshots)

---

## 🧩 Project Overview

**NexMart** is a cloud-native, fully serverless e-commerce platform architected on AWS using a microservices design pattern. It is not a traditional CRUD application — it is engineered to reflect how real-world production e-commerce systems operate at scale, with a clear separation of concerns, event-driven architecture, and deep observability baked in from day one.

The platform is built around the principle of **zero server management**: there are no EC2 instances to patch, no servers to provision, and no capacity to pre-plan. Every compute, storage, auth, and observability concern is delegated to managed AWS services, assembled and governed entirely through **Terraform Infrastructure as Code**.

| Dimension | Detail |
|---|---|
| **Architecture Style** | Microservices + Serverless |
| **Cloud Provider** | Amazon Web Services (AWS) |
| **Frontend Hosting** | Amazon S3 + CloudFront (CDN) |
| **Auth** | Amazon Cognito (JWT-based, Role-Based Access Control) |
| **Backend** | API Gateway + AWS Lambda |
| **Database** | Amazon DynamoDB (NoSQL) |
| **Observability** | CloudWatch + X-Ray + SNS |
| **IaC** | Terraform (split frontend/backend stacks) |

---

## 💼 Business Problem

Traditional e-commerce backends are commonly deployed as monolithic applications on fixed infrastructure — a design that introduces several operational and scalability challenges:

- **Scaling bottlenecks:** The entire application must be scaled even when only one component (e.g., the cart service) is under load.
- **Single point of failure:** A bug in one module can bring down the entire platform.
- **Operational overhead:** Managing servers, patching OS, handling capacity planning, and maintaining uptime consume significant engineering resources.
- **Slow release cycles:** Tightly coupled services mean a change to the order module requires redeploying the entire application.
- **High idle cost:** Fixed infrastructure runs at full cost 24/7, regardless of actual traffic.

**NexMart solves these problems** by decomposing the platform into independently deployable microservices, each backed by a dedicated AWS Lambda function. Traffic scales automatically, billing is per-invocation, deployments are isolated to individual services, and observability is first-class — not bolted on.

---

## 🏗️ Architecture Diagrams

### High-Level System Architecture

```
                          ┌─────────────────────────────────────────────────────────┐
                          │                      USERS                               │
                          │            (Customers & Admins)                          │
                          └──────────────────────┬──────────────────────────────────┘
                                                 │ HTTPS
                                                 ▼
                          ┌──────────────────────────────────────────────────────────┐
                          │               Amazon CloudFront (CDN)                    │
                          │          Global Edge Locations / SSL/TLS                 │
                          └──────────────────────┬───────────────────────────────────┘
                                                 │ Origin Request (OAC)
                                                 ▼
                          ┌──────────────────────────────────────────────────────────┐
                          │               Amazon S3 (Static Hosting)                 │
                          │    HTML + CSS + JS │ Login │ Signup │ Email Verify       │
                          └──────────────────────┬───────────────────────────────────┘
                                                 │ API Calls (JWT in Header)
                                                 ▼
                          ┌──────────────────────────────────────────────────────────┐
                          │             Amazon Cognito User Pool                     │
                          │       Authentication │ JWT Issuance │ RBAC              │
                          └──────────────────────┬───────────────────────────────────┘
                                                 │ Bearer Token
                                                 ▼
                          ┌──────────────────────────────────────────────────────────┐
                          │             Amazon API Gateway (REST API)                │
                          │     Request Routing │ JWT Authorizer │ Throttling        │
                          └────────┬────────────┬────────────────┬───────────────────┘
                                   │            │                │
                         ┌─────────▼──┐  ┌──────▼─────┐  ┌─────▼──────────┐
                         │  Product   │  │    Cart    │  │     Order      │
                         │  Service   │  │  Service   │  │    Service     │
                         │ (Lambda)   │  │ (Lambda)   │  │   (Lambda)     │
                         └─────────┬──┘  └──────┬─────┘  └─────┬──────────┘
                                   │            │                │
                                   └────────────┴────────────────┘
                                                │
                                                ▼
                          ┌──────────────────────────────────────────────────────────┐
                          │               Amazon DynamoDB                            │
                          │   Products Table │ Carts Table │ Orders Table           │
                          └──────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                          ┌──────────────────────────────────────────────────────────┐
                          │            Observability Layer                           │
                          │   CloudWatch Logs │ X-Ray Traces │ SNS Alarms           │
                          └──────────────────────────────────────────────────────────┘
```

---

### Authentication & Authorization Flow

```
  User                 CloudFront/S3           Cognito               API Gateway          Lambda
   │                        │                     │                       │                  │
   │─── Open App ──────────►│                     │                       │                  │
   │◄── Login Page ─────────│                     │                       │                  │
   │                        │                     │                       │                  │
   │─── Submit Credentials ─────────────────────►│                       │                  │
   │                        │  Authenticate User  │                       │                  │
   │                        │  Verify Email       │                       │                  │
   │                        │  Check User Group   │                       │                  │
   │◄────────────────── JWT Tokens (ID + Access + Refresh) ──────────────│                  │
   │                        │                     │                       │                  │
   │─── API Request + Bearer Token ──────────────────────────────────────►│                  │
   │                        │                     │  Validate JWT         │                  │
   │                        │                     │  (Verify Signature,   │                  │
   │                        │                     │   Expiry, Audience)   │                  │
   │                        │                     │◄──────────────────────│                  │
   │                        │                     │  Extract Claims:      │                  │
   │                        │                     │  - sub (userId)       │                  │
   │                        │                     │  - cognito:groups     │                  │
   │                        │                     │  (admin/customer)     │                  │
   │                        │                     │──────────────────────►│                  │
   │                        │                     │                       │─── Route ────────►│
   │                        │                     │                       │                  │
   │                        │                     │                       │◄── Response ──────│
   │◄─────────────────────────────────────── 200 OK + Payload ───────────│                  │
```

---

### Microservices Architecture

```
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                        Amazon API Gateway                                    │
  │                                                                              │
  │  /products ──────── GET, POST, PUT, DELETE                                  │
  │  /cart     ──────── GET, POST, DELETE                                        │
  │  /orders   ──────── GET, POST, PUT                                           │
  └──────────┬──────────────────┬────────────────────────┬──────────────────────┘
             │                  │                         │
             ▼                  ▼                         ▼
  ┌─────────────────┐  ┌─────────────────┐    ┌─────────────────────┐
  │  Product        │  │  Cart           │    │  Order              │
  │  Service        │  │  Service        │    │  Service            │
  │  (Lambda)       │  │  (Lambda)       │    │  (Lambda)           │
  │─────────────────│  │─────────────────│    │─────────────────────│
  │ listProducts    │  │ getCart         │    │ createOrder         │
  │ getProduct      │  │ addToCart       │    │ getOrderById        │
  │ createProduct   │  │ removeFromCart  │    │ getUserOrders       │
  │ updateProduct   │  │ clearCart       │    │ updateOrderStatus   │
  │ deleteProduct   │  │                 │    │ getAllOrders (admin) │
  └────────┬────────┘  └────────┬────────┘    └──────────┬──────────┘
           │                    │                         │
           ▼                    ▼                         ▼
  ┌─────────────────┐  ┌─────────────────┐    ┌─────────────────────┐
  │  Products       │  │  Carts          │    │  Orders             │
  │  DynamoDB Table │  │  DynamoDB Table │    │  DynamoDB Table     │
  └─────────────────┘  └─────────────────┘    └─────────────────────┘
           │                    │                         │
           └────────────────────┴─────────────────────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │   AWS X-Ray Tracing    │
                   │   (all services)       │
                   └────────────────────────┘
```

---

## ☁️ AWS Services Used

| Service | Purpose | Category |
|---|---|---|
| **Amazon S3** | Static frontend hosting (HTML, CSS, JS) | Storage |
| **Amazon CloudFront** | Global CDN with HTTPS, caching, and OAC | Networking |
| **Origin Access Control (OAC)** | Restricts S3 access to CloudFront only | Security |
| **Amazon Cognito User Pool** | User registration, login, JWT issuance | Auth |
| **Cognito App Client** | OAuth 2.0 client configuration | Auth |
| **Amazon API Gateway** | RESTful API routing, auth, throttling | Compute |
| **AWS Lambda** | Serverless compute for each microservice | Compute |
| **Amazon DynamoDB** | NoSQL database for products, carts, orders | Database |
| **Amazon CloudWatch** | Logs, dashboards, alarms, metrics | Observability |
| **Amazon SNS** | Alert notifications via email | Notifications |
| **AWS X-Ray** | Distributed tracing across services | Observability |
| **AWS IAM** | Fine-grained permissions for all services | Security |
| **Terraform** | Infrastructure provisioning and management | IaC |

---

## ✨ Features

### Customer Features

- 🔐 **Secure Authentication** — Register, log in, and verify email via Amazon Cognito
- 🛍️ **Product Browsing** — View the full product catalog with name, description, price, and stock info
- 🛒 **Shopping Cart** — Add, update, and remove items from a persistent cart (scoped per user)
- 📦 **Order Placement** — Checkout and create orders, which are persisted in DynamoDB
- 📋 **Order History** — View all past orders with status tracking
- 🔑 **JWT Session Management** — Token-based auth with automatic refresh handling
- 📱 **Responsive UI** — Frontend delivered over CloudFront for sub-100ms global page loads

### Admin Features

- 🔒 **Role-Based Access** — Admin users are members of the `Admin` Cognito group; unauthorized routes return `403 Forbidden`
- ➕ **Product Management** — Create, update, and delete products via the admin panel
- 📊 **Order Management** — View all platform orders and update order statuses (`PENDING` → `SHIPPED` → `DELIVERED`)
- 📈 **Business Metrics Dashboard** — CloudWatch dashboard showing orders, revenue, active carts, and Lambda error rates in real time

---

## 🔐 Security Architecture

NexMart follows the AWS Well-Architected Framework's Security Pillar across all layers of the stack.

### Layers of Defense

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Layer 1: Network Edge                                                      │
│  CloudFront OAC — only CloudFront can access S3; direct S3 URLs return 403 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 2: Identity & Access                                                 │
│  Cognito User Pool — enforced email verification, password policy,          │
│  JWT-based sessions, group membership (Admin/Customer)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 3: API Authorization                                                 │
│  API Gateway JWT Authorizer — validates token signature and expiry before   │
│  forwarding to Lambda; admin routes check cognito:groups claim              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 4: Compute                                                           │
│  Lambda runs with least-privilege IAM roles (per service, per action)      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Layer 5: Data                                                              │
│  DynamoDB encryption at rest (AWS-managed keys), HTTPS-only data in transit │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cognito Authentication & Authorization

Amazon Cognito serves as the identity provider for NexMart. The setup includes:

- **User Pool** — Manages the user directory; enforces email uniqueness, password policy, and MFA readiness
- **Email Verification** — Users must verify their email before they can log in
- **App Client** — Configured for SRP (Secure Remote Password) authentication with no client secret (suitable for browser-based SPAs)
- **User Groups**:
  - `Admin` — has elevated permissions to manage products and all orders
  - Customers (no group) — can only access their own cart and orders
- **Custom UI Pages** — Login, signup, and email verification pages are hosted on S3/CloudFront (not the Cognito Hosted UI), giving full control over branding and UX

### JWT Token Flow

```
1. User submits credentials to Cognito via InitiateAuth (SRP)
2. Cognito returns three tokens:
   ├── ID Token     — contains user identity claims (sub, email, cognito:groups)
   ├── Access Token — used for API authorization (sent as Bearer token)
   └── Refresh Token — long-lived token for silent re-authentication

3. Frontend stores tokens securely (memory / sessionStorage)
4. Every API request includes:
   Authorization: Bearer <AccessToken>

5. API Gateway JWT Authorizer:
   ├── Fetches Cognito JWKS (JSON Web Key Set) from:
   │   https://cognito-idp.<region>.amazonaws.com/<userPoolId>/.well-known/jwks.json
   ├── Verifies token signature using public key
   ├── Validates: iss (issuer), aud (audience), exp (expiry)
   └── Passes claims to Lambda via $context.authorizer

6. Lambda extracts:
   ├── userId from sub claim (user-scoped data operations)
   └── group from cognito:groups claim (admin route guard)
```

---

## 📡 API Documentation

All endpoints are served through Amazon API Gateway. The base URL follows the pattern:

```
https://<api-id>.execute-api.<region>.amazonaws.com/<stage>
```

### Authentication Header

All protected endpoints require:

```http
Authorization: Bearer <Cognito AccessToken>
```

---

### 🏪 Products API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/products` | Public | List all products |
| `GET` | `/products/{id}` | Public | Get a single product by ID |
| `POST` | `/products` | Admin | Create a new product |
| `PUT` | `/products/{id}` | Admin | Update product details |
| `DELETE` | `/products/{id}` | Admin | Delete a product |

**POST /products — Request Body**
```json
{
  "name": "Wireless Headphones",
  "description": "Noise-cancelling over-ear headphones",
  "price": 79.99,
  "stock": 150,
  "category": "Electronics",
  "imageUrl": "https://cdn.example.com/headphones.jpg"
}
```

**GET /products — Response**
```json
{
  "products": [
    {
      "productId": "prod_abc123",
      "name": "Wireless Headphones",
      "description": "Noise-cancelling over-ear headphones",
      "price": 79.99,
      "stock": 150,
      "category": "Electronics",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ]
}
```

---

### 🛒 Cart API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/cart` | Customer | Get the authenticated user's cart |
| `POST` | `/cart` | Customer | Add or update an item in the cart |
| `DELETE` | `/cart/{productId}` | Customer | Remove a specific item from the cart |
| `DELETE` | `/cart` | Customer | Clear the entire cart |

**POST /cart — Request Body**
```json
{
  "productId": "prod_abc123",
  "quantity": 2
}
```

---

### 📦 Orders API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/orders` | Customer | Place a new order from cart |
| `GET` | `/orders` | Customer | Get all orders for the authenticated user |
| `GET` | `/orders/{id}` | Customer/Admin | Get a specific order by ID |
| `PUT` | `/orders/{id}/status` | Admin | Update order status |
| `GET` | `/admin/orders` | Admin | Get all orders across all users |

**POST /orders — Response**
```json
{
  "orderId": "ord_xyz789",
  "userId": "user_cognito_sub",
  "items": [
    { "productId": "prod_abc123", "name": "Wireless Headphones", "quantity": 2, "price": 79.99 }
  ],
  "totalAmount": 159.98,
  "status": "PENDING",
  "createdAt": "2025-06-01T14:22:00Z"
}
```

**PUT /orders/{id}/status — Request Body**
```json
{
  "status": "SHIPPED"
}
```

---

## 🗄️ DynamoDB Design

DynamoDB is the primary data store for all three microservices. Each service owns its table — there is no shared schema between services, which preserves service isolation.

### Design Philosophy

NexMart uses a **single-table design pattern per service** with composite keys (Partition Key + Sort Key) to support multiple access patterns without expensive scans. All tables use **on-demand (pay-per-request) billing** to match the serverless cost model.

---

### Products Table (`nexmart-products`)

| Attribute | Type | Notes |
|---|---|---|
| `productId` (PK) | String | UUID, e.g. `prod_abc123` |
| `name` | String | Product display name |
| `description` | String | Full product description |
| `price` | Number | Stored as decimal |
| `stock` | Number | Available inventory count |
| `category` | String | Used with GSI for category browsing |
| `imageUrl` | String | CDN URL |
| `createdAt` | String | ISO 8601 timestamp |

**GSI: CategoryIndex** — PK: `category`, SK: `createdAt` → enables filtering products by category

---

### Carts Table (`nexmart-carts`)

| Attribute | Type | Notes |
|---|---|---|
| `userId` (PK) | String | Cognito `sub` claim |
| `productId` (SK) | String | One item per product per user |
| `quantity` | Number | Cart item quantity |
| `addedAt` | String | ISO 8601 timestamp |

Each user's cart is a set of items stored as separate rows with `userId + productId` as the composite key. This allows O(1) reads and atomic updates per item.

---

### Orders Table (`nexmart-orders`)

| Attribute | Type | Notes |
|---|---|---|
| `orderId` (PK) | String | UUID, e.g. `ord_xyz789` |
| `userId` (SK) | String | Cognito `sub` claim |
| `items` | List | Snapshot of cart items at checkout |
| `totalAmount` | Number | Calculated at order creation |
| `status` | String | `PENDING` / `PROCESSING` / `SHIPPED` / `DELIVERED` / `CANCELLED` |
| `createdAt` | String | ISO 8601 timestamp |
| `updatedAt` | String | ISO 8601 timestamp |

**GSI: UserOrdersIndex** — PK: `userId`, SK: `createdAt` → enables efficient query of all orders for a given user, sorted by time

---

## 📊 Observability & Monitoring

NexMart is built with **full-stack observability** — every Lambda invocation, API Gateway request, and business event is captured, measured, and alerted on.

### CloudWatch Dashboard

A custom CloudWatch Dashboard (`NexMart-Overview`) provides a real-time operational view of the platform:

| Widget | Metric | Purpose |
|---|---|---|
| API Gateway Requests | `Count` by endpoint | Traffic volume per service |
| Lambda Error Rate | `Errors / Invocations` | Service health |
| Lambda Duration (P50/P95/P99) | `Duration` | Performance profiling |
| DynamoDB Read/Write Capacity | Consumed vs provisioned | Database utilization |
| Orders Created (Business) | Custom metric | Order volume trend |
| Revenue (Business) | Custom metric | GMV over time |
| Active Carts | Custom metric | Engagement funnel |

### CloudWatch Alarms

| Alarm | Threshold | Action |
|---|---|---|
| Lambda Error Rate High | `>5%` over 5 minutes | SNS notification |
| Lambda P99 Latency High | `>3000ms` | SNS notification |
| API Gateway 5XX Errors | `>10` per 5 minutes | SNS notification |
| DynamoDB Throttled Requests | `>0` | SNS notification |
| Order Service Failures | `>3` errors in 5 min | SNS notification |

### SNS Notifications

All CloudWatch Alarms publish to an **Amazon SNS Topic** (`nexmart-alerts`). The topic delivers email alerts to configured subscribers. This enables on-call notification without requiring third-party tooling.

Notification format example:
```
ALARM: nexmart-lambda-error-rate-high
State: ALARM
Reason: Threshold Crossed: 1 datapoint [7.8%] > 5%
Namespace: AWS/Lambda
FunctionName: nexmart-order-service
```

### AWS X-Ray

AWS X-Ray is enabled on all Lambda functions and API Gateway stages. This provides:

- **End-to-end request tracing** — from API Gateway → Lambda → DynamoDB
- **Service map** — visual graph of all service dependencies and their latencies
- **Subsegment annotations** — custom metadata attached to traces (userId, orderId, operation)
- **Error root cause analysis** — trace individual failed requests through all service hops
- **Cold start detection** — Lambda initialization time tracked as a separate trace segment

Sample X-Ray trace for a `POST /orders` request:
```
API Gateway (12ms)
  └── Order Service Lambda (243ms)
        ├── [Init] Lambda cold start (180ms)
        ├── Cognito claim extraction (2ms)
        ├── DynamoDB GetItem — Cart (18ms)
        ├── DynamoDB PutItem — Order (22ms)
        └── DynamoDB DeleteItems — Cart (21ms)
```

### Business Metrics

Lambda functions emit custom CloudWatch metrics using the `PutMetricData` API:

```javascript
// Example: emitted from Order Service after successful order creation
await cloudwatch.putMetricData({
  Namespace: 'NexMart/Business',
  MetricData: [
    { MetricName: 'OrdersCreated', Value: 1, Unit: 'Count' },
    { MetricName: 'OrderRevenue',  Value: totalAmount, Unit: 'None' }
  ]
}).promise();
```

| Metric Namespace | Metric Name | Emitted By |
|---|---|---|
| `NexMart/Business` | `OrdersCreated` | Order Service |
| `NexMart/Business` | `OrderRevenue` | Order Service |
| `NexMart/Business` | `CartItemsAdded` | Cart Service |
| `NexMart/Business` | `ProductViews` | Product Service |

---

## 🏗️ Infrastructure as Code

### Why Two Separate Terraform Projects?

NexMart deliberately separates its infrastructure into two independent Terraform state files:

```
eccommerce-terraform/terraform/    ← Backend Infrastructure
frontend-terraform/terraform/      ← Frontend Infrastructure
```

**Rationale:**

| Concern | Backend Stack | Frontend Stack |
|---|---|---|
| **Deployment frequency** | Changes with code (Lambda ZIPs, API routes) | Changes rarely (S3 bucket, CloudFront) |
| **State blast radius** | Lambda + DynamoDB + Cognito + IAM | S3 + CloudFront + OAC |
| **Team ownership** | Backend engineers | Frontend engineers / DevOps |
| **Destroy safety** | Destroy only clears backend; S3 bucket and CDN remain | Can teardown CDN without touching data |
| **CI/CD pipelines** | Separate pipeline triggered on backend changes | Separate pipeline triggered on frontend asset changes |

Mixing both stacks in a single `terraform apply` would mean a frontend CDN invalidation triggers a full Terraform plan across Lambda, DynamoDB, IAM — introducing unnecessary risk and slow feedback loops.

---

### Terraform Project Structure

```
nexmart/
├── eccommerce-terraform/
│   └── terraform/
│       ├── main.tf                  # Root module, provider config
│       ├── variables.tf             # Input variables
│       ├── outputs.tf               # API Gateway URL, Cognito IDs
│       ├── terraform.tfvars         # Environment-specific values (gitignored)
│       ├── modules/
│       │   ├── api_gateway/         # REST API, stages, deployment
│       │   │   ├── main.tf
│       │   │   ├── variables.tf
│       │   │   └── outputs.tf
│       │   ├── lambda/              # Functions, roles, layers, X-Ray config
│       │   │   ├── main.tf
│       │   │   ├── variables.tf
│       │   │   └── outputs.tf
│       │   ├── dynamodb/            # Tables, GSIs, TTL, billing mode
│       │   │   ├── main.tf
│       │   │   ├── variables.tf
│       │   │   └── outputs.tf
│       │   ├── cognito/             # User Pool, App Client, User Groups
│       │   │   ├── main.tf
│       │   │   ├── variables.tf
│       │   │   └── outputs.tf
│       │   ├── cloudwatch/          # Dashboards, Alarms, Log Groups
│       │   │   ├── main.tf
│       │   │   ├── variables.tf
│       │   │   └── outputs.tf
│       │   ├── sns/                 # Alert topic, email subscriptions
│       │   │   ├── main.tf
│       │   │   ├── variables.tf
│       │   │   └── outputs.tf
│       │   └── iam/                 # Lambda execution roles, policies
│       │       ├── main.tf
│       │       ├── variables.tf
│       │       └── outputs.tf
│       └── lambda_src/
│           ├── product-service/     # Node.js Lambda source
│           ├── cart-service/
│           └── order-service/
│
└── frontend-terraform/
    └── terraform/
        ├── main.tf                  # Root module
        ├── variables.tf
        ├── outputs.tf               # CloudFront distribution URL
        ├── terraform.tfvars
        └── modules/
            ├── s3/                  # Bucket, bucket policy, static website
            │   ├── main.tf
            │   ├── variables.tf
            │   └── outputs.tf
            ├── cloudfront/          # Distribution, OAC, cache behaviors
            │   ├── main.tf
            │   ├── variables.tf
            │   └── outputs.tf
            └── deployment/          # S3 sync of frontend assets
                ├── main.tf
                ├── variables.tf
                └── outputs.tf
```

---

### Deployment Steps

#### Prerequisites

```bash
# Required tools
aws --version      # AWS CLI v2
terraform --version # Terraform >= 1.5
node --version     # Node.js >= 18.x (for Lambda packaging)
```

#### Step 1 — Configure AWS Credentials

```bash
aws configure
# AWS Access Key ID:     <your-key>
# AWS Secret Access Key: <your-secret>
# Default region:        us-east-1
# Output format:         json
```

#### Step 2 — Deploy Backend Infrastructure

```bash
cd eccommerce-terraform/terraform

# Initialize Terraform (download providers, set up remote state)
terraform init

# Review the execution plan
terraform plan -var-file="terraform.tfvars"

# Apply infrastructure
terraform apply -var-file="terraform.tfvars"

# Capture outputs (API Gateway URL, Cognito User Pool ID, etc.)
terraform output
```

Key outputs used by the frontend:
```
api_gateway_url         = "https://abc123.execute-api.us-east-1.amazonaws.com/prod"
cognito_user_pool_id    = "us-east-1_XXXXXXXXX"
cognito_app_client_id   = "XXXXXXXXXXXXXXXXXXXXXXXXXX"
```

#### Step 3 — Update Frontend Config

```javascript
// frontend/config.js
const CONFIG = {
  API_BASE_URL:      "https://abc123.execute-api.us-east-1.amazonaws.com/prod",
  USER_POOL_ID:      "us-east-1_XXXXXXXXX",
  APP_CLIENT_ID:     "XXXXXXXXXXXXXXXXXXXXXXXXXX",
  REGION:            "us-east-1"
};
```

#### Step 4 — Deploy Frontend Infrastructure

```bash
cd frontend-terraform/terraform

terraform init
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"

# Outputs CloudFront distribution URL
terraform output cloudfront_url
```

#### Step 5 — Seed an Admin User (Optional)

```bash
# Create admin user in Cognito
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin@nexmart.com \
  --user-attributes Name=email,Value=admin@nexmart.com Name=email_verified,Value=true \
  --temporary-password TempPass@123

# Add user to Admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_XXXXXXXXX \
  --username admin@nexmart.com \
  --group-name Admin
```

#### Teardown

```bash
# Destroy backend (Lambda, DynamoDB, Cognito, etc.)
cd eccommerce-terraform/terraform
terraform destroy -var-file="terraform.tfvars"

# Destroy frontend (S3, CloudFront, OAC)
cd frontend-terraform/terraform
terraform destroy -var-file="terraform.tfvars"
```

> ⚠️ DynamoDB tables and Cognito User Pool will be permanently deleted on destroy. Back up any production data before running destroy.

---

## 🧪 Testing Strategy

### Unit Testing (Lambda Functions)

Each Lambda microservice includes unit tests using **Jest** (Node.js):

```bash
cd eccommerce-terraform/terraform/lambda_src/product-service
npm install
npm test
```

Tests cover:
- Handler logic (happy path and error cases)
- DynamoDB client mocking (using `aws-sdk-mock` or `@aws-sdk/client-dynamodb` mocks)
- Input validation
- JWT claim extraction logic
- HTTP response shape (status codes, body structure)

### Integration Testing (API Gateway + Lambda)

Integration tests use the **AWS SAM CLI** for local emulation or deploy to a staging environment:

```bash
# Test a real endpoint against staging environment
curl -X GET https://<api-id>.execute-api.us-east-1.amazonaws.com/staging/products \
  -H "Authorization: Bearer <test-token>"
```

### End-to-End Testing

Manual E2E test scenarios:

| Scenario | Steps | Expected |
|---|---|---|
| Customer signup | Register → verify email → login | JWT tokens returned; user in DB |
| Add to cart | Auth → GET /products → POST /cart | Cart item stored in DynamoDB |
| Place order | POST /orders | Order created; cart cleared |
| Admin auth guard | Non-admin calls POST /products | `403 Forbidden` |
| Token expiry | Wait for token expiry; call API | `401 Unauthorized` |

### Infrastructure Testing (Terraform)

```bash
# Validate Terraform syntax
terraform validate

# Check formatting
terraform fmt --check

# Preview changes before apply
terraform plan -detailed-exitcode
```

---

## 🧗 Challenges & Learnings

### 1. Cognito JWT Authorizer Setup
**Challenge:** Configuring API Gateway to correctly validate Cognito JWTs, especially mapping the `cognito:groups` claim for admin authorization without a Lambda authorizer.

**Learning:** API Gateway HTTP APIs support native JWT authorizers with Cognito as the issuer. Admin route protection is achieved by Lambda reading the `event.requestContext.authorizer.jwt.claims` object and checking `cognito:groups`.

---

### 2. CORS Between CloudFront and API Gateway
**Challenge:** Cross-origin requests from the CloudFront domain to the API Gateway domain were initially blocked, causing authentication failures.

**Learning:** API Gateway requires explicit CORS configuration per route (or on the API level for HTTP APIs). Lambda responses also need to return the correct `Access-Control-Allow-Origin` header matching the CloudFront domain.

---

### 3. DynamoDB Single-Table Design
**Challenge:** Designing the Orders table to support both "get a single order" and "get all orders for a user" without a full table scan.

**Learning:** Composite keys alone aren't enough for both access patterns. Adding a GSI (`UserOrdersIndex` with `userId` as PK and `createdAt` as SK) enabled O(log n) user-scoped queries while keeping the primary key optimized for `orderId` lookups.

---

### 4. Terraform State Isolation
**Challenge:** Initially, all infrastructure was in a single Terraform project. A failed frontend apply would roll back backend changes mid-deploy.

**Learning:** Splitting into two independent state files (backend + frontend) eliminated this coupling. Each stack can be planned, applied, and destroyed independently without risk to the other.

---

### 5. Lambda Cold Starts
**Challenge:** First requests to rarely-invoked Lambda functions experienced latency spikes of 500–800ms due to cold starts.

**Learning:** Identified cold starts via X-Ray traces (the `Init` subsegment). Mitigation strategies explored: Lambda provisioned concurrency (for critical paths), reducing deployment package size, and avoiding heavy SDK imports at the module level.

---

## 🔮 Future Enhancements

| Enhancement | Description | AWS Service(s) |
|---|---|---|
| **Payment Integration** | Integrate Stripe or PayPal for real payment processing | Lambda + API Gateway |
| **Event-Driven Order Processing** | Decouple order creation from fulfillment using async messaging | Amazon SQS + EventBridge |
| **Email Notifications** | Send order confirmation and shipping update emails | Amazon SES |
| **Product Search** | Full-text search across products by name and category | Amazon OpenSearch Service |
| **CI/CD Pipeline** | Automate Terraform plan/apply on every PR merge | AWS CodePipeline + CodeBuild |
| **Caching Layer** | Cache frequent product reads to reduce DynamoDB load | Amazon ElastiCache (Redis) |
| **Image Uploads** | Allow admins to upload product images directly | Amazon S3 + Pre-signed URLs |
| **Multi-Region** | Deploy to a second region with Route 53 failover | Route 53 + Global Tables |
| **Rate Limiting** | Per-user API throttling to prevent abuse | API Gateway Usage Plans |
| **Secrets Management** | Migrate all secrets from env vars to Secrets Manager | AWS Secrets Manager |

---

## 📸 Screenshots

> *Add screenshots of the live application here. Suggested captures:*

| Screen | Description |
|---|---|
| `screenshots/01-homepage.png` | Product catalog landing page via CloudFront |
| `screenshots/02-login.png` | Custom Cognito login page |
| `screenshots/03-signup.png` | Custom Cognito signup page |
| `screenshots/04-email-verify.png` | Email verification flow |
| `screenshots/05-product-detail.png` | Single product view |
| `screenshots/06-cart.png` | Shopping cart with items |
| `screenshots/07-order-placed.png` | Order confirmation screen |
| `screenshots/08-order-history.png` | Customer order history |
| `screenshots/09-admin-products.png` | Admin product management panel |
| `screenshots/10-admin-orders.png` | Admin all-orders view with status update |
| `screenshots/11-cloudwatch-dashboard.png` | CloudWatch NexMart-Overview dashboard |
| `screenshots/12-xray-trace.png` | X-Ray service map and trace detail |
| `screenshots/13-terraform-apply.png` | Terraform apply output |
| `screenshots/14-cognito-userpool.png` | Cognito User Pool console view |

---

<div align="center">

**Built with ❤️ on AWS**

*NexMart — Serverless. Scalable. Production-Ready.*

[![AWS](https://img.shields.io/badge/Powered%20by-AWS-FF9900?style=flat-square&logo=amazonaws)](https://aws.amazon.com/)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-7B42BC?style=flat-square&logo=terraform)](https://www.terraform.io/)

</div>
