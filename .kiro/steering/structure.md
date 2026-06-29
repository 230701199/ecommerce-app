# NexMart — Project Structure

## Top-Level Layout

```
ecommerce-app/
├── docs/architecture/           # Architecture diagrams (PNG)
├── eccommerce-terraform/        # Backend: services + infra
│   ├── cart-service/
│   ├── order-service/
│   ├── product-service/
│   ├── terraform/               # Backend Terraform configs
│   ├── business-metrics.js      # Shared CloudWatch metrics helper
│   └── build/                   # Lambda ZIP artifacts (generated)
├── frontend-terraform/          # Frontend: static files + infra
│   ├── *.html, *.js, *.css      # Static frontend
│   └── terraform/               # S3 + CloudFront Terraform
└── smoke-test.sh                # E2E validation script
```

## Microservice Structure

Each service is independently deployable with its own `package.json` and `node_modules`.

### cart-service (Clean Architecture)

```
cart-service/src/
├── application/usecases/    # Business logic (addItemToCart, getCartItems, removeCartItem)
├── domain/entities/         # Domain models (CartItem)
├── domain/errors/           # Custom errors (AppError)
├── config/                  # Environment config
├── tests/                   # Jest unit tests
├── business-metrics.js      # Service-local metrics wrapper
└── server.js                # Express app + Lambda handler export
```

### order-service (Controller/Service)

```
order-service/src/
├── controllers/             # Route handlers
├── services/                # Business logic
├── config/                  # Environment config
├── order.js                 # Express routes
├── server.js                # Lambda handler wrapper
└── order.test.js            # Jest + Supertest tests
```

### product-service (Layered/MVC)

```
product-service/src/
├── controllers/             # Route handlers
├── middleware/              # notFound, errorHandler
├── models/                  # Data models
├── routes/                  # Express route definitions
├── utils/                   # Helpers
├── tests/                   # Jest tests
├── app.js                   # Express app factory (createApp)
└── server.js                # Lambda handler
```

## Terraform Layout

```
eccommerce-terraform/terraform/
├── provider.tf              # AWS provider config (region, profile)
├── variable.tf              # Input variables
├── main.tf                  # Top-level wiring
├── output.tf                # Stack outputs
├── lambda.tf                # Lambda function definitions
├── dynamodb.tf              # DynamoDB tables (products, cart, orders)
├── api-gateway.tf           # HTTP API routes + JWT authorizer
├── cognito.tf               # User pool, client, domain, groups
├── iam.tf                   # IAM roles and policies
├── cloudwatch.tf            # Alarms, dashboard, X-Ray config
├── monitor.tf               # Additional monitoring resources
├── lambda-monitor.tf        # Monitor Lambda function
└── permissions.tf           # Lambda invoke permissions
```

## Key Conventions

- **Database-per-service**: Each microservice owns its own DynamoDB table
- **Lambda handler pattern**: `module.exports.handler = serverless(app)` in every service
- **Terraform naming**: Resources prefixed with `${var.project_name}-`
- **Separate Terraform states**: Backend and frontend infra are managed independently
- **Shared metrics module**: `business-metrics.js` at the eccommerce-terraform root, imported by services via relative path
