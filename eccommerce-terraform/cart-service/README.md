# Cart Service (Express + DynamoDB)

## Endpoints
- `POST /cart` → add item to cart
- `GET /cart/:userId` → get cart items
- `DELETE /cart/:userId/:productId` → remove item

## Data model (DynamoDB)
- Partition key: `userId` (string)
- Sort key: `productId` (string)
- Attributes: `quantity` (number), `createdAt` (string), `updatedAt` (string)

## Setup
1. Install:

```bash
npm install
```

2. Create `.env` from `.env.example`.

3. Run:

```bash
npm run dev
```

## Example request

```bash
curl -X POST http://localhost:3001/cart ^
  -H "Content-Type: application/json" ^
  -d "{\"userId\":\"u1\",\"productId\":\"p1\",\"quantity\":2}"
```

