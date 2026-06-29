# NexMart — Tech Stack & Build

## Runtime & Language

- Node.js 18.x, pure JavaScript (no TypeScript)
- CommonJS modules (`require` / `module.exports`)

## Frameworks & Libraries

| Concern | Library |
|---------|---------|
| Web framework | Express.js |
| Serverless adapter | serverless-http |
| Database client | aws-sdk v2 DynamoDB.DocumentClient |
| CloudWatch metrics | @aws-sdk/client-cloudwatch (v3) |
| Security middleware | helmet, cors, express-rate-limit, compression |
| Validation | express-validator |
| HTTP client | axios (inter-service calls) |
| Env config | dotenv |
| Logging | morgan |

## Infrastructure

| Layer | Technology |
|-------|-----------|
| Compute | AWS Lambda |
| API | AWS API Gateway HTTP API (v2) |
| Database | Amazon DynamoDB (on-demand/PAY_PER_REQUEST) |
| Auth | Amazon Cognito (JWT authorizer) |
| CDN/Frontend | S3 + CloudFront |
| IaC | Terraform (AWS provider ~6.42, archive ~2.8) |
| Observability | CloudWatch alarms/dashboards, X-Ray, SNS |
| Region | ap-southeast-1 (Singapore) |

## Testing

- Jest for unit and integration tests
- Supertest for HTTP-level testing against Express apps
- `jest.mock('aws-sdk')` pattern for mocking AWS services
- Shell-based smoke tests (`smoke-test.sh`)

## Common Commands

### Per-service (run from within each service directory)

```bash
npm test          # Run Jest tests
npm run dev       # Local development with nodemon
npm start         # Start without hot-reload
```

### Terraform (run from eccommerce-terraform/terraform/)

```bash
terraform init    # Initialize providers
terraform plan    # Preview changes
terraform apply   # Deploy infrastructure
```

### Smoke test (run from repo root)

```bash
./smoke-test.sh   # End-to-end validation against deployed API
```
