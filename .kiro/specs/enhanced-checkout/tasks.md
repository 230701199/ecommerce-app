# Implementation Plan: Enhanced Checkout

## Overview

This plan implements the multi-step checkout wizard for NexMart, replacing the single-click "Place Order Now" flow with a Cart Review → Delivery Address → Payment Method → Order Summary/Confirmation process. Implementation covers backend validation, checkout API endpoint, idempotency, frontend wizard, geolocation auto-fill, and session state management.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - [x] 1.1 Create checkout validator module in order-service
    - Create `order-service/src/validators/checkoutValidator.js`
    - Implement express-validator middleware chain for: userId (required, non-empty), deliveryAddress object (street 1–200 chars, city 1–100 chars, state 1–100 chars, pincode exactly 6 digits, landmark optional 0–200 chars), paymentMethod enum (COD/UPI), conditional upiId validation (required when UPI, regex `/^[a-zA-Z0-9.\-]+@[a-zA-Z0-9]+$/`, 3–50 chars), items array size (1–50)
    - Return HTTP 400 with list of all invalid field names on validation failure
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 1.2 Write property tests for checkout validator
    - **Property 3: Address Validation Correctness**
    - **Property 4: Pincode Format Validation**
    - **Property 5: UPI ID Format Validation**
    - **Property 6: Payment Method Enum Validation**
    - Create `order-service/src/tests/checkout.property.test.js`
    - Use fast-check to generate random address objects, pincode strings, UPI ID strings, and payment method strings
    - Validate that the validator accepts/rejects correctly for each property with minimum 100 iterations
    - **Validates: Requirements 2.2, 2.4, 2.5, 4.6, 7.1, 7.2, 7.3, 7.4, 7.5**

  - [x] 1.3 Create idempotency provider module
    - Create `order-service/src/services/idempotencyProvider.js`
    - Implement `checkAndSet(idempotencyKey, userId)` using DynamoDB conditional put with TTL (30 seconds)
    - Implement `getExistingOrder(idempotencyKey)` to return previously created order if key exists
    - Use partition key pattern `IDEMPOTENCY#<idempotencyKey>` in the orders table
    - _Requirements: 11.5_

- [x] 2. Implement checkout service logic
  - [x] 2.1 Create checkout service with order creation logic
    - Create `order-service/src/services/checkoutService.js`
    - Implement `processCheckout(userId, deliveryAddress, paymentMethod, paymentDetails, idempotencyKey)` that:
      - Fetches cart items from Cart Service via axios
      - Fetches product data from Product Service to validate stock and get current prices
      - Calculates line totals (price × quantity) and cart total (sum of line totals)
      - Generates UUID orderId
      - Creates order record in DynamoDB with all fields (items, deliveryAddress, paymentMethod, paymentDetails, totalAmount, status "CREATED", createdAt ISO 8601, idempotencyKey)
      - Reduces stock via Product Service
      - Clears cart via Cart Service (best-effort, log failure without rollback)
    - Handle error cases: empty cart (400), insufficient stock (400 with product name + available qty), Cart Service unreachable (502), stock reduction failure (500)
    - _Requirements: 6.1, 6.2, 6.4, 6.6, 8.2, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2_

  - [x] 2.2 Write property tests for order creation invariants
    - **Property 1: Line Total Calculation**
    - **Property 2: Cart Total is Sum of Line Totals**
    - **Property 7: Order Creation Invariants**
    - Add to `order-service/src/tests/checkout.property.test.js`
    - Use fast-check to generate random prices (0.01–9999.99) and quantities (1–100), verify lineTotal = price × qty
    - Generate arrays of 1–50 items with random lineTotals, verify sum equals cartTotal
    - Generate valid checkout data, create order, verify output has UUID orderId, status "CREATED", ISO timestamp, and correct totalAmount
    - **Validates: Requirements 1.1, 1.3, 6.1, 6.2, 9.2**

  - [x] 2.3 Implement checkout controller and route
    - Create `order-service/src/controllers/checkoutController.js`
    - Implement `checkoutHandler(req, res)` that:
      - Extracts request body fields
      - Checks idempotency key via idempotencyProvider (return 409 with original order if duplicate)
      - Calls checkoutService.processCheckout
      - Returns 201 with created order object (orderId, items, deliveryAddress, paymentMethod, paymentDetails, totalAmount, status, createdAt)
    - Register `POST /orders/checkout` route in `order-service/src/order.js` with JWT auth middleware and checkoutValidator middleware
    - _Requirements: 8.1, 8.2, 8.3, 11.5_

  - [x] 2.4 Write property test for idempotent submission
    - **Property 8: Idempotent Order Submission**
    - Add to `order-service/src/tests/checkout.property.test.js`
    - Use fast-check to generate valid order data with same idempotency key, submit twice, verify same orderId returned both times and no second order created
    - **Validates: Requirements 11.5**

  - [x] 2.5 Write unit tests for checkout service
    - Create `order-service/src/tests/checkout.test.js`
    - Test cases: valid checkout creates order with correct structure, UUID generated, ISO timestamp, empty cart returns 400, insufficient stock returns product name + available qty, Cart Service unreachable returns 502, stock reduction failure returns 500, cart clear failure does not rollback order, duplicate idempotency key returns original order
    - Mock aws-sdk DynamoDB, mock axios for inter-service calls
    - _Requirements: 6.1, 6.2, 6.4, 6.6, 8.2, 8.4, 8.5, 8.6, 8.7_

- [x] 3. Implement order retrieval with new fields
  - [x] 3.1 Update GET /orders/:userId to return enhanced order data
    - Modify `order-service/src/services/` (existing order service) to return deliveryAddress, paymentMethod, paymentDetails, totalAmount, status, and createdAt fields
    - Ensure empty array returned when no orders exist for the userId
    - Filter out IDEMPOTENCY# prefixed records from query results
    - _Requirements: 9.3, 9.4_

  - [x] 3.2 Write unit tests for order retrieval
    - Test that GET /orders/:userId returns all new fields (deliveryAddress, paymentMethod, paymentDetails, totalAmount, status, createdAt)
    - Test empty array returned for non-existent user
    - Test that idempotency records are excluded from results
    - _Requirements: 9.3, 9.4_

- [x] 4. Checkpoint - Backend implementation verified
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement frontend checkout page structure
  - [x] 5.1 Create checkout HTML page with wizard layout
    - Create `frontend-terraform/checkout.html`
    - Implement multi-step wizard with 4 step panels: Cart Review, Delivery Address, Payment Method, Order Summary
    - Add progress indicator showing current step number and total (e.g., "Step 2 of 4") with step name
    - Include Back and Next navigation buttons (Back hidden on step 1)
    - Add "Proceed to Checkout" button placement (replaces "Place Order Now")
    - Link to checkout.js and checkout.css
    - _Requirements: 10.1, 10.2, 10.3, 12.1_

  - [x] 5.2 Create checkout CSS styles
    - Create `frontend-terraform/checkout.css`
    - Style step panels (show/hide), progress indicator, form fields, validation error messages, loading indicators, disabled button states
    - Match existing NexMart frontend styling conventions
    - _Requirements: 10.1, 10.2_

- [x] 6. Implement frontend checkout JavaScript logic
  - [x] 6.1 Implement CheckoutWizard core with step navigation and session management
    - Create `frontend-terraform/checkout.js`
    - Implement `initCheckout()` — loads cart data via GET /cart/:userId, restores session state, renders step 1
    - Implement `navigateToStep(stepNumber)` — validates current step, transitions to target
    - Implement `renderStep(stepNumber)` — shows/hides panels, updates progress indicator
    - Implement `preserveState()` — saves form data + current step + timestamp to sessionStorage
    - Implement `restoreState()` — loads state if within 30-minute window
    - Implement `SessionManager` with save/load/clear/isExpired methods
    - Disable "Proceed to Checkout" when cart is empty; disable "Next" if cart becomes empty during review
    - Display error message if cart data fails to load
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 10.1, 10.4, 10.5, 11.3, 11.4_

  - [x] 6.2 Implement delivery address step with validation
    - Add delivery address form rendering with fields: street (max 200), city (max 100), state (max 100), pincode (6 digits), landmark (optional, max 200)
    - Implement `validateAddressStep()` — checks non-whitespace required fields, pincode format, shows field-specific error messages
    - Prevent navigation and retain field values on validation error
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 6.3 Implement address auto-detect with geolocation
    - Implement "Use Current Location" button
    - Implement `detectLocation()` — requests browser Geolocation API with 10-second timeout
    - Implement `reverseGeocode(lat, lng)` — calls Nominatim OpenStreetMap API
    - Implement `populateAddressFields(address)` — fills form fields with resolved data
    - Show loading indicator and disable button during request
    - Handle errors: permission denied, timeout, reverse geocoding failure — show appropriate message and prompt manual entry
    - Allow editing of auto-filled values
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 6.4 Implement payment method step with validation
    - Render two options: COD and UPI (no pre-selection)
    - Show "payment collected at delivery" note when COD selected
    - Show UPI ID input field when UPI selected
    - Implement `validatePaymentStep()` — require selection, validate UPI ID format if UPI selected
    - Clear payment-specific details when switching methods
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 6.5 Implement order summary and submission
    - Render summary showing: product list with name/quantity/price/lineTotal, delivery address, payment method (+ UPI ID if applicable), total amount
    - Implement `submitOrder()` — generates UUID idempotency key, sends POST /orders/checkout with all collected data
    - Disable "Confirm Order" button and show loading indicator during submission
    - Handle 10-second timeout with retry (up to 3 times)
    - Handle success: display order ID, navigate to orders section, clear cart state
    - Handle errors: 400 (show specific message), 401 (redirect to login, preserve state), 409 (show success with original order), 502 (show retry), 500 (show error)
    - Implement "Back" button to return to payment step with data preserved
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.3, 10.6, 11.1, 11.2, 11.3_

- [x] 7. Implement checkout navigation integration
  - [x] 7.1 Update cart page to integrate with checkout flow
    - Modify cart page (`frontend-terraform/cart.html` or relevant file) to replace "Place Order Now" button with "Proceed to Checkout" button when cart has items
    - Implement navigation from cart to checkout.html with cart review step active
    - Add "Back to Cart" on first checkout step that navigates back with cart unchanged and checkout state preserved
    - Handle empty cart after navigation: redirect back to cart page with message
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 8. Checkpoint - Frontend implementation verified
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Integration testing and wiring
  - [x] 9.1 Write integration tests for checkout endpoint
    - Create `order-service/src/tests/checkout.integration.test.js`
    - Test POST /orders/checkout happy path (201 with complete order object)
    - Test no JWT returns 401
    - Test empty cart returns 400
    - Test insufficient stock returns 400 with product name and available quantity
    - Test Cart Service unreachable returns 502
    - Test stock reduction fails returns 500
    - Test duplicate submission within 30s returns 409 with original order
    - Test GET /orders/:userId returns orders with delivery/payment fields
    - Test GET /orders/:userId with no orders returns empty array
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.3, 9.4_

  - [x] 9.2 Wire frontend to backend and verify end-to-end flow
    - Ensure checkout.js uses correct API Gateway endpoint URLs for POST /orders/checkout and GET /cart/:userId
    - Verify JWT token is included in Authorization header for checkout submission
    - Ensure CORS configuration on API Gateway allows checkout.html origin
    - Update `frontend-terraform/terraform/` if needed to deploy checkout.html and checkout.css via CloudFront
    - _Requirements: 8.1, 10.1, 12.2_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend uses the existing Controller/Service pattern in order-service
- Frontend follows existing static HTML/JS/CSS pattern served via CloudFront
- Idempotency uses the same DynamoDB orders table with a prefixed key pattern to avoid extra infrastructure
- Reverse geocoding uses Nominatim (free, no API key needed)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "5.1", "5.2"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.2", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 5, "tasks": ["6.5", "7.1"] },
    { "id": 6, "tasks": ["9.1", "9.2"] }
  ]
}
```
