# Requirements Document

## Introduction

This document defines the requirements for the Enhanced Checkout feature in NexMart. The current checkout flow allows users to place orders directly from the cart with a single click, bypassing any review, address collection, or payment method selection. The enhanced flow introduces a multi-step checkout process where users review their cart, provide a delivery address, select a payment method, review an order summary, and confirm before the order is placed. This ensures better user experience, fewer accidental orders, and support for multiple payment methods.

## Glossary

- **Checkout_Flow**: The multi-step process a customer follows from cart review through order confirmation
- **Order_Service**: The backend microservice responsible for creating, storing, and managing orders
- **Cart_Service**: The backend microservice responsible for managing shopping cart items
- **Checkout_Page**: The frontend page that guides the user through the checkout steps
- **Delivery_Address**: A structured object containing street address, city, state, pincode, and optional landmark
- **Payment_Method**: The method selected by the customer to pay for the order; one of COD or UPI
- **COD**: Cash on Delivery — payment collected at the time of physical delivery
- **UPI**: Unified Payments Interface — digital payment collected before order dispatch
- **Order_Summary**: A read-only view showing cart items, quantities, delivery address, payment method, and total amount before confirmation
- **Geolocation_API**: The browser Geolocation API used to auto-detect the user's current coordinates
- **Reverse_Geocoding**: The process of converting latitude/longitude coordinates into a human-readable address
- **Checkout_Validator**: The component responsible for validating all required checkout fields before order submission

## Requirements

### Requirement 1: Cart Review Step

**User Story:** As a customer, I want to review my cart items with quantities and prices before proceeding to checkout, so that I can verify what I am ordering.

#### Acceptance Criteria

1. WHEN the customer clicks the "Proceed to Checkout" button in the cart, THE Checkout_Page SHALL display all cart items with product name, quantity, unit price, and line total calculated as unit price multiplied by quantity.
2. WHILE the cart contains zero items, THE Checkout_Page SHALL disable the "Proceed to Checkout" button.
3. WHEN the customer is on the cart review step, THE Checkout_Page SHALL display the cart total amount calculated as the sum of all line totals.
4. WHEN the customer clicks "Next" on the cart review step, THE Checkout_Flow SHALL navigate to the delivery address step.
5. IF the cart data fails to load when the customer clicks "Proceed to Checkout", THEN THE Checkout_Page SHALL display an error message indicating that cart items could not be retrieved and SHALL NOT navigate away from the cart view.
6. IF the cart becomes empty while the customer is on the cart review step, THEN THE Checkout_Page SHALL disable the "Next" button and SHALL display a message indicating the cart is empty.

### Requirement 2: Delivery Address Collection

**User Story:** As a customer, I want to provide my delivery address during checkout, so that the order can be delivered to my specified location.

#### Acceptance Criteria

1. WHEN the customer reaches the delivery address step, THE Checkout_Page SHALL display a form with fields for street address (maximum 200 characters), city (maximum 100 characters), state (maximum 100 characters), pincode (exactly 6 digits), and landmark (optional, maximum 200 characters).
2. THE Checkout_Validator SHALL require street address, city, state, and pincode fields to contain at least one non-whitespace character.
3. WHEN the customer submits the delivery address form with all required fields populated and pincode containing exactly 6 digits, THE Checkout_Flow SHALL navigate to the payment method step.
4. IF the customer submits the delivery address form with missing or whitespace-only required fields, THEN THE Checkout_Validator SHALL display an error message indicating which specific fields are missing.
5. IF the customer submits the delivery address form with a pincode that does not contain exactly 6 digits, THEN THE Checkout_Validator SHALL display an error message indicating the pincode format is invalid.
6. THE Checkout_Validator SHALL prevent form submission and retain all entered field values when any validation error is displayed.

### Requirement 3: Auto-Detect Location

**User Story:** As a customer, I want an option to use my current location to auto-fill my delivery address, so that I can quickly provide an address without typing.

#### Acceptance Criteria

1. WHEN the customer clicks the "Use Current Location" button, THE Checkout_Page SHALL request the browser Geolocation_API for the current coordinates with a timeout of 10 seconds.
2. WHEN the Geolocation_API returns coordinates within valid latitude (-90 to 90) and longitude (-180 to 180) ranges, THE Checkout_Page SHALL perform Reverse_Geocoding and populate the street address, city, state, pincode, and landmark fields with the resolved address.
3. IF the Geolocation_API returns an error, the user denies permission, or the geolocation request exceeds the 10-second timeout, THEN THE Checkout_Page SHALL display a message indicating that location detection failed and prompt manual entry.
4. WHEN auto-detected address fields are populated, THE Checkout_Page SHALL allow the customer to edit the auto-filled values before proceeding.
5. WHILE the Geolocation_API request or Reverse_Geocoding is in progress, THE Checkout_Page SHALL display a loading indicator and disable the "Use Current Location" button until the operation completes or times out.
6. IF the Reverse_Geocoding service returns an error or fails to resolve an address from the obtained coordinates, THEN THE Checkout_Page SHALL display a message indicating that the address could not be determined and prompt manual entry.

### Requirement 4: Payment Method Selection

**User Story:** As a customer, I want to choose a payment method during checkout, so that I can pay using my preferred method.

#### Acceptance Criteria

1. WHEN the customer reaches the payment method step, THE Checkout_Page SHALL display two options: COD and UPI, with no option pre-selected.
2. IF the customer attempts to proceed without selecting a payment method, THEN THE Checkout_Validator SHALL display an error message requiring a payment method selection.
3. WHEN the customer selects COD, THE Checkout_Page SHALL display a note stating payment will be collected at delivery.
4. WHEN the customer selects UPI, THE Checkout_Page SHALL display a UPI ID input field.
5. IF the customer selects UPI and the UPI ID field is empty, THEN THE Checkout_Validator SHALL display an error message requiring a valid UPI ID.
6. IF the customer selects UPI and the UPI ID does not match the format "username@provider" (alphanumeric characters, dots, or hyphens followed by @ and a provider name, 3–50 characters total), THEN THE Checkout_Validator SHALL display an error message indicating the UPI ID format is invalid.
7. WHEN the customer switches between payment methods, THE Checkout_Page SHALL clear any previously entered payment-specific details (such as UPI ID).

### Requirement 5: Order Summary and Confirmation

**User Story:** As a customer, I want to see a complete order summary before confirming my order, so that I can review all details and avoid mistakes.

#### Acceptance Criteria

1. WHEN the customer reaches the order summary step, THE Checkout_Page SHALL display the list of products with name, quantity, unit price, and line total.
2. WHEN the customer reaches the order summary step, THE Checkout_Page SHALL display the selected delivery address showing street, city, state, pincode, and landmark (if provided).
3. WHEN the customer reaches the order summary step, THE Checkout_Page SHALL display the selected payment method and, if UPI is selected, the associated UPI ID.
4. WHEN the customer reaches the order summary step, THE Checkout_Page SHALL display the total order amount.
5. WHEN the customer clicks the "Confirm Order" button, THE Checkout_Flow SHALL submit the order including cart items, delivery address, payment method, and payment details to the Order_Service within a 30-second timeout.
6. WHILE the order submission is in progress, THE Checkout_Page SHALL disable the "Confirm Order" button and display a loading indicator.
7. WHEN the customer clicks the "Back" button on the order summary step, THE Checkout_Flow SHALL navigate to the payment method step with previously entered data preserved.

### Requirement 6: Order Submission and Storage

**User Story:** As a customer, I want my confirmed order to be stored and visible in my orders list, so that I can track my purchases.

#### Acceptance Criteria

1. WHEN the Order_Service receives a valid order submission, THE Order_Service SHALL store the order with items, delivery address, payment method, payment details, total amount, status set to "CREATED", and createdAt timestamp in ISO 8601 format in the orders DynamoDB table.
2. WHEN the Order_Service successfully creates an order, THE Order_Service SHALL return the complete order object with a generated UUID order ID.
3. WHEN the order is successfully placed, THE Checkout_Page SHALL display a success message with the order ID.
4. WHEN the order is successfully placed, THE Cart_Service SHALL clear the customer's cart.
5. WHEN the customer navigates to the Orders page, THE Order_Service SHALL return orders that include delivery address, payment method, payment details, total amount, status, and createdAt fields.
6. IF the Cart_Service fails to clear the cart after order creation, THEN THE Order_Service SHALL log the failure and SHALL NOT roll back the order.

### Requirement 7: Checkout Field Validation (Backend)

**User Story:** As a system operator, I want the backend to validate all checkout fields independently of the frontend, so that invalid data cannot bypass client-side checks.

#### Acceptance Criteria

1. THE Order_Service SHALL validate that the order request contains a non-empty userId, a non-empty items array with at most 50 items, a delivery address object with street (1–200 characters), city (1–100 characters), state (1–100 characters), and pincode, and a valid payment method.
2. IF the Order_Service receives an order request with missing or invalid required fields, THEN THE Order_Service SHALL return HTTP 400 with an error response listing all invalid fields by name.
3. IF the Order_Service receives a payment method value other than "COD" or "UPI", THEN THE Order_Service SHALL return HTTP 400 with an error message stating the payment method is invalid.
4. IF the payment method is "UPI" and no UPI ID is provided or the UPI ID does not match the format "username@provider" (alphanumeric and dots before @, alphanumeric after @, 3–50 characters total), THEN THE Order_Service SHALL return HTTP 400 with an error message requiring a valid UPI ID.
5. IF the pincode does not contain exactly 6 digits, THEN THE Order_Service SHALL return HTTP 400 with an error message indicating the pincode is invalid.

### Requirement 8: Checkout API Design

**User Story:** As a developer, I want a well-defined checkout API endpoint, so that the frontend can submit complete checkout data in a single request.

#### Acceptance Criteria

1. THE Order_Service SHALL expose a POST /orders/checkout endpoint that accepts userId, delivery address, payment method, and payment details in the request body, and SHALL require a valid JWT authorization token.
2. WHEN the POST /orders/checkout endpoint receives a valid request, THE Order_Service SHALL execute the following steps in order: fetch the cart items from Cart_Service, validate stock availability, calculate totals, create the order, reduce stock, and clear the cart.
3. WHEN the POST /orders/checkout endpoint processes successfully, THE Order_Service SHALL return HTTP 201 with the created order object including orderId, items, deliveryAddress, paymentMethod, totalAmount, status, and createdAt.
4. IF the cart is empty when POST /orders/checkout is called, THEN THE Order_Service SHALL return HTTP 400 with the message "Cart is empty".
5. IF stock validation fails during checkout, THEN THE Order_Service SHALL return HTTP 400 with a message identifying the product name and available stock quantity.
6. IF the Cart_Service is unreachable during checkout, THEN THE Order_Service SHALL return HTTP 502 with an error message indicating the cart could not be retrieved, and SHALL NOT create an order.
7. IF stock reduction fails after order creation, THEN THE Order_Service SHALL return HTTP 500 with an error message indicating stock update failed, and the order SHALL NOT be considered successfully placed.

### Requirement 9: Database Schema Update

**User Story:** As a developer, I want the order data model to include delivery address and payment information, so that this data is persisted and retrievable.

#### Acceptance Criteria

1. THE Order_Service SHALL store each order with the following attributes: orderId (partition key), userId, items array (maximum 50 items), deliveryAddress object (street, city, state, pincode, landmark where each string field is at most 255 characters), paymentMethod (COD or UPI), paymentDetails object (containing upiId of at most 50 characters when paymentMethod is UPI, or an empty object when paymentMethod is COD), totalAmount (numeric value from 0.01 to 999,999,999.99), status, and createdAt (ISO 8601 timestamp).
2. WHEN an order is stored, THE Order_Service SHALL set the initial status to "CREATED".
3. WHEN an existing order is retrieved via GET /orders/:userId, THE Order_Service SHALL return all stored attributes including deliveryAddress, paymentMethod, paymentDetails, totalAmount, status, and createdAt for each order belonging to that user.
4. IF GET /orders/:userId is called and no orders exist for the given userId, THEN THE Order_Service SHALL return an empty array.

### Requirement 10: Frontend Checkout Component

**User Story:** As a customer, I want a dedicated checkout page with a step-by-step wizard, so that the process is clear and guided.

#### Acceptance Criteria

1. THE Checkout_Page SHALL implement a multi-step wizard with four sequential steps: Cart Review, Delivery Address, Payment Method, and Order Summary, where the customer must complete each step before advancing to the next.
2. THE Checkout_Page SHALL display a progress indicator showing the current step number and total number of steps (e.g., "Step 2 of 4") along with the name of the current step.
3. WHEN the customer is on any step after the first, THE Checkout_Page SHALL display a "Back" button to return to the previous step.
4. IF the customer clicks "Next" on a step that has not passed its validation rules, THEN THE Checkout_Page SHALL remain on the current step and display the relevant validation errors without advancing.
5. THE Checkout_Page SHALL preserve all entered data across all visited steps when navigating between steps using Back and Next buttons within the same session.
6. WHEN the customer completes the checkout successfully, THE Checkout_Page SHALL navigate to the Orders section and display the newly created order.

### Requirement 11: Edge Case Handling

**User Story:** As a customer, I want the checkout process to handle unexpected situations gracefully, so that I am informed and can take corrective action.

#### Acceptance Criteria

1. IF a product in the cart becomes out of stock after the customer begins checkout, THEN THE Order_Service SHALL return HTTP 400 with a message identifying the out-of-stock product and available quantity.
2. IF the Order_Service does not respond within 10 seconds during order submission, THEN THE Checkout_Page SHALL display an error message indicating the service is unavailable and allow the customer to retry up to 3 times.
3. IF the customer's session token expires during checkout, THEN THE Checkout_Page SHALL redirect the customer to the login page and preserve the checkout state so it is restored upon successful re-authentication.
4. WHEN the customer navigates away from the checkout page using the browser back button, THE Checkout_Page SHALL preserve the entered delivery address, selected payment method, and current step for 30 minutes from the last interaction.
5. IF the customer submits the same order twice within a 30-second window, THEN THE Order_Service SHALL detect the duplicate submission, prevent a second order from being created, and return the original order response.

### Requirement 12: Checkout Navigation Integration

**User Story:** As a customer, I want to access the checkout from the cart page and navigate back if needed, so that the checkout feels integrated into the application.

#### Acceptance Criteria

1. WHILE the customer is on the cart page with at least one item, THE Checkout_Page SHALL display a "Proceed to Checkout" button in place of the existing "Place Order Now" button.
2. WHEN the customer clicks "Proceed to Checkout", THE Checkout_Flow SHALL navigate to the Checkout_Page with the cart review step active.
3. WHEN the customer clicks "Back to Cart" on the first checkout step, THE Checkout_Flow SHALL navigate back to the cart page with the cart contents unchanged and the checkout state preserved for the session duration.
4. IF the cart becomes empty after the customer has navigated to the Checkout_Page, THEN THE Checkout_Flow SHALL navigate the customer back to the cart page and display a message indicating the cart is empty.
