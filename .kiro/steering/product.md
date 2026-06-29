# NexMart — Product Summary

NexMart is a cloud-native, fully serverless e-commerce platform built on AWS. It provides:

- Product catalog browsing and management (admin CRUD)
- Shopping cart with add/update/remove operations
- Order placement with stock validation and cart clearing
- Admin order management (view all orders, update statuses)
- JWT-based authentication via Amazon Cognito with role-based access control (admin vs customer)

The platform is deployed as independently scalable microservices with zero server management — all compute, storage, auth, and observability run on managed AWS services. Infrastructure is governed entirely through Terraform.

Live frontend is served via CloudFront CDN; backend API is exposed through AWS API Gateway HTTP API.
