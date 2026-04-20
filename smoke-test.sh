#!/bin/bash

API_URL="https://hmc6vv0vv2.execute-api.ap-southeast-1.amazonaws.com"
USER_ID="test-user"

echo "🔍 Running Smoke Tests..."
echo "----------------------------------"

# 🧹 0. Clear existing cart
echo "0. Clearing existing cart..."
CART_ITEMS=$(curl -k -s $API_URL/cart/$USER_ID)

for pid in $(echo $CART_ITEMS | grep -o '"productId":"[^"]*"' | cut -d':' -f2 | tr -d '"'); do
  curl -k -s -X DELETE $API_URL/cart/$USER_ID/$pid > /dev/null
done

echo "Cart cleared"
echo "----------------------------------"

# 1. Get products
echo "1. Get all products"
curl -k -s -o /dev/null -w "Status: %{http_code}\n" $API_URL/products
echo "----------------------------------"

# 2. Create product
echo "2. Create product (admin)"
CREATE_RESPONSE=$(curl -k -s -X POST $API_URL/products \
-H "Content-Type: application/json" \
-H "role: admin" \
-d '{"name":"SmokeTest-AUTO","price":100,"category":"test","stock":10}')

echo "$CREATE_RESPONSE"

# Extract product ID
PRODUCT_ID=$(echo $CREATE_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

if [ -z "$PRODUCT_ID" ]; then
  echo "❌ Product creation failed. Stopping test."
  exit 1
fi

echo "Created Product ID: $PRODUCT_ID"
echo "----------------------------------"

# 3. Get product by ID
echo "3. Get product by ID"
curl -k -s -o /dev/null -w "Status: %{http_code}\n" \
$API_URL/products/$PRODUCT_ID
echo "----------------------------------"

# 4. Add to cart
echo "4. Add to cart"
curl -k -s -X POST $API_URL/cart \
-H "Content-Type: application/json" \
-d "{\"userId\":\"$USER_ID\",\"productId\":\"$PRODUCT_ID\",\"quantity\":2}"
echo ""
echo "----------------------------------"

# 5. Verify cart
echo "5. Get cart (debug)"
CART_RESPONSE=$(curl -k -s $API_URL/cart/$USER_ID)
echo "$CART_RESPONSE"
echo "----------------------------------"

if [[ "$CART_RESPONSE" == "[]" || -z "$CART_RESPONSE" ]]; then
  echo "❌ Cart is empty. Stopping test."
  exit 1
fi

# 6. Create order
echo "6. Create order"
ORDER_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" \
-X POST $API_URL/orders \
-H "Content-Type: application/json" \
-d "{\"userId\":\"$USER_ID\"}")

echo "Status: $ORDER_STATUS"
echo "----------------------------------"

# 🧹 7. Cleanup (delete product)
echo "7. Cleaning up test data..."

DELETE_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" \
-X DELETE $API_URL/products/$PRODUCT_ID \
-H "role: admin")

if [ "$DELETE_STATUS" = "200" ] || [ "$DELETE_STATUS" = "204" ]; then
  echo "✅ Product deleted successfully"
else
  echo "⚠️ Failed to delete product (Status: $DELETE_STATUS)"
fi

echo "----------------------------------"
echo "🚀 Smoke Test Completed"