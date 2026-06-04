#!/bin/bash

API_URL="https://o8kqf93jnf.execute-api.ap-southeast-1.amazonaws.com"
USER_ID="test-user"
USER_POOL_ID="ap-southeast-1_Pwak67UsW"
CLIENT_ID="2qv50999jltmlrfm3tria2kqcf"
PROFILE="idp-sbx-trn-lab-01"

echo "Logging in to Cognito..."
# Create temporary test user
aws cognito-idp admin-create-user --user-pool-id $USER_POOL_ID --username test-smoke@example.com --user-attributes Name=email,Value=test-smoke@example.com Name=email_verified,Value=true --message-action SUPPRESS --profile $PROFILE > /dev/null 2>&1
# Set password
aws cognito-idp admin-set-user-password --user-pool-id $USER_POOL_ID --username test-smoke@example.com --password "TestPass123!" --permanent --profile $PROFILE > /dev/null 2>&1
# Add to admin group
aws cognito-idp admin-add-user-to-group --user-pool-id $USER_POOL_ID --username test-smoke@example.com --group-name admin --profile $PROFILE > /dev/null 2>&1

# Authenticate to retrieve token
AUTH_RESULT=$(aws cognito-idp initiate-auth --client-id $CLIENT_ID --auth-flow USER_PASSWORD_AUTH --auth-parameters USERNAME=test-smoke@example.com,PASSWORD=TestPass123! --profile $PROFILE)
ACCESS_TOKEN=$(echo $AUTH_RESULT | grep -o '"AccessToken": "[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "Failed to retrieve access token. Skipping Cognito authorization."
  AUTH_HEADER="role: admin"
else
  echo "Successfully logged in."
  AUTH_HEADER="Authorization: Bearer $ACCESS_TOKEN"
fi
echo "----------------------------------"

echo "🔍 Running Smoke Tests..."
echo "----------------------------------"

# 🧹 0. Clear existing cart
echo "0. Clearing existing cart..."
CART_ITEMS=$(curl -k -s -H "$AUTH_HEADER" $API_URL/cart/$USER_ID)

for pid in $(echo $CART_ITEMS | grep -o '"productId":"[^"]*"' | cut -d':' -f2 | tr -d '"'); do
  curl -k -s -X DELETE -H "$AUTH_HEADER" $API_URL/cart/$USER_ID/$pid > /dev/null
done

echo "Cart cleared"
echo "----------------------------------"

# 1. Get products
echo "1. Get all products"
curl -k -s -o /dev/null -w "Status: %{http_code}\n" -H "$AUTH_HEADER" $API_URL/products
echo "----------------------------------"

# 2. Create product
echo "2. Create product (admin)"
CREATE_RESPONSE=$(curl -k -s -X POST $API_URL/products \
-H "Content-Type: application/json" \
-H "$AUTH_HEADER" \
-d '{"name":"SmokeTest-AUTO","price":100,"category":"test","stock":10}')

echo "$CREATE_RESPONSE"

# Extract product ID
PRODUCT_ID=$(echo $CREATE_RESPONSE | grep -o '"id":[0-9]*' | grep -o '[0-9]*')

if [ -z "$PRODUCT_ID" ]; then
  echo "❌ Product creation failed. Stopping test."
  # Cleanup user before exiting
  aws cognito-idp admin-delete-user --user-pool-id $USER_POOL_ID --username test-smoke@example.com --profile $PROFILE > /dev/null 2>&1
  exit 1
fi

echo "Created Product ID: $PRODUCT_ID"
echo "----------------------------------"

# 3. Get product by ID
echo "3. Get product by ID"
curl -k -s -o /dev/null -w "Status: %{http_code}\n" \
-H "$AUTH_HEADER" \
$API_URL/products/$PRODUCT_ID
echo "----------------------------------"

# 4. Add to cart
echo "4. Add to cart"
curl -k -s -X POST $API_URL/cart \
-H "Content-Type: application/json" \
-H "$AUTH_HEADER" \
-d "{\"userId\":\"$USER_ID\",\"productId\":\"$PRODUCT_ID\",\"quantity\":2}"
echo ""
echo "----------------------------------"

# 5. Verify cart
echo "5. Get cart (debug)"
CART_RESPONSE=$(curl -k -s -H "$AUTH_HEADER" $API_URL/cart/$USER_ID)
echo "$CART_RESPONSE"
echo "----------------------------------"

if [[ "$CART_RESPONSE" == "[]" || -z "$CART_RESPONSE" ]]; then
  echo "❌ Cart is empty. Stopping test."
  aws cognito-idp admin-delete-user --user-pool-id $USER_POOL_ID --username test-smoke@example.com --profile $PROFILE > /dev/null 2>&1
  exit 1
fi

# 6. Create order
echo "6. Create order"
ORDER_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" \
-X POST $API_URL/orders \
-H "Content-Type: application/json" \
-H "$AUTH_HEADER" \
-d "{\"userId\":\"$USER_ID\"}")

echo "Status: $ORDER_STATUS"
echo "----------------------------------"

# 🧹 7. Cleanup (delete product)
echo "7. Cleaning up test data..."

DELETE_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" \
-X DELETE $API_URL/products/$PRODUCT_ID \
-H "$AUTH_HEADER")

if [ "$DELETE_STATUS" = "200" ] || [ "$DELETE_STATUS" = "204" ]; then
  echo "✅ Product deleted successfully"
else
  echo "⚠️ Failed to delete product (Status: $DELETE_STATUS)"
fi

# Clean up Cognito test user
aws cognito-idp admin-delete-user --user-pool-id $USER_POOL_ID --username test-smoke@example.com --profile $PROFILE > /dev/null 2>&1

echo "----------------------------------"
echo "🚀 Smoke Test Completed"