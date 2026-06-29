/**
 * checkout.js — NexMart Multi-Step Checkout Wizard
 *
 * Implements the 4-step checkout flow:
 *   Step 1: Cart Review
 *   Step 2: Delivery Address
 *   Step 3: Payment Method
 *   Step 4: Order Summary & Confirmation
 *
 * Dependencies: auth.js (loaded before this script)
 */

/* ─── CONFIGURATION ─────────────────────────────────────────────────────── */

const CHECKOUT_API = "https://o8kqf93jnf.execute-api.ap-southeast-1.amazonaws.com";
const SESSION_STORAGE_KEY = "nexmart_checkout_state";
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/* ─── SESSION MANAGER ────────────────────────────────────────────────────── */

const SessionManager = {
  save(state) {
    const payload = {
      ...state,
      lastUpdated: new Date().toISOString()
    };
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn("Failed to save checkout state:", e);
    }
  },

  load() {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw);
      if (this.isExpired(state)) {
        this.clear();
        return null;
      }
      return state;
    } catch (e) {
      console.warn("Failed to load checkout state:", e);
      return null;
    }
  },

  clear() {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  },

  isExpired(state) {
    const s = state || this.load();
    if (!s || !s.lastUpdated) return true;
    const lastUpdated = new Date(s.lastUpdated).getTime();
    if (isNaN(lastUpdated)) return true;
    return (Date.now() - lastUpdated) > SESSION_EXPIRY_MS;
  }
};

/* ─── CHECKOUT STATE ─────────────────────────────────────────────────────── */

let checkoutState = {
  currentStep: 1,
  cartItems: [],
  deliveryAddress: {
    street: "",
    city: "",
    state: "",
    pincode: "",
    landmark: ""
  },
  paymentMethod: null,
  paymentDetails: {
    upiId: ""
  }
};

/* ─── STEP NAMES ─────────────────────────────────────────────────────────── */

const STEP_NAMES = {
  1: "Cart Review",
  2: "Delivery Address",
  3: "Payment Method",
  4: "Order Summary"
};

const TOTAL_STEPS = 4;

/* ─── INITIALIZATION ─────────────────────────────────────────────────────── */

/**
 * Initialize the checkout wizard.
 * Loads cart data, restores session state, and renders step 1.
 */
async function initCheckout() {
  // Restore session state first (if available and not expired)
  restoreState();

  // Load fresh cart data from the API
  await loadCheckoutCart();

  // Setup payment option click listeners
  setupPaymentListeners();

  // Render the appropriate step
  renderStep(checkoutState.currentStep);
}

/**
 * Load cart data from the Cart Service API.
 * Also fetches products to get actual prices and names.
 */
async function loadCheckoutCart() {
  var userId = getCheckoutUserId();
  var cartItemsEl = document.getElementById("checkout-cart-items");
  var btnNext = document.getElementById("btn-next");

  try {
    // Fetch cart items and products in parallel
    var results = await Promise.all([
      fetch(CHECKOUT_API + "/cart/" + userId),
      fetch(CHECKOUT_API + "/products")
    ]);

    var cartRes = results[0];
    var productsRes = results[1];

    if (!cartRes.ok) {
      throw new Error("Failed to load cart (HTTP " + cartRes.status + ")");
    }

    var cartData = await cartRes.json();

    // Parse products list
    var allProducts = [];
    if (productsRes.ok) {
      var productsBody = await productsRes.json();
      allProducts = productsBody.data || productsBody || [];
    }

    // data is an array of cart items: [{ productId, quantity, ... }]
    if (!Array.isArray(cartData)) {
      throw new Error("Invalid cart data format");
    }

    // If the API returns an empty cart, redirect back to cart page
    if (cartData.length === 0) {
      window.location.href = "index.html?msg=cart_empty#cart";
      return;
    }

    checkoutState.cartItems = cartData.map(function(item) {
      // Look up product by matching productId (with Number coercion)
      var product = allProducts.find(function(p) {
        return Number(p.id) === Number(item.productId);
      });

      return {
        productId: item.productId,
        name: product ? product.name : "Unknown Product",
        quantity: item.quantity || 1,
        price: product ? product.price : 0
      };
    });

    // Update button states based on cart content
    updateCartButtonStates();
    preserveState();

  } catch (err) {
    console.error("Cart load error:", err);
    checkoutState.cartItems = [];

    if (cartItemsEl) {
      cartItemsEl.innerHTML = '<div class="checkout-empty">' +
        '<span class="checkout-empty-icon">❌</span>' +
        '<span class="checkout-empty-text">Unable to load cart items. Please try again.</span>' +
        '<button class="checkout-btn-next" onclick="loadCheckoutCart().then(function() { renderStep(1); })" style="margin-top:16px;"><span>🔄 Retry</span></button>' +
        '</div>';
    }

    // Disable Next when cart fails to load
    if (btnNext) {
      btnNext.disabled = true;
    }
  }
}

/**
 * Get the current user's ID from auth.js.
 */
function getCheckoutUserId() {
  var user = getCurrentUser();
  return user && user.sub ? user.sub : "guest";
}

/* ─── STEP NAVIGATION ────────────────────────────────────────────────────── */

function navigateToStep(stepNumber) {
  if (stepNumber < 1 || stepNumber > TOTAL_STEPS) return;

  if (stepNumber > checkoutState.currentStep) {
    if (!validateCurrentStep()) return;
  }

  captureFormData();
  preserveState();

  checkoutState.currentStep = stepNumber;
  renderStep(stepNumber);
  preserveState();
}

function navigateNext() {
  navigateToStep(checkoutState.currentStep + 1);
}

function navigatePrev() {
  captureFormData();
  preserveState();

  if (checkoutState.currentStep === 1) {
    window.location.href = "index.html#cart";
    return;
  }

  checkoutState.currentStep = checkoutState.currentStep - 1;
  renderStep(checkoutState.currentStep);
  preserveState();
}

/* ─── STEP RENDERING ─────────────────────────────────────────────────────── */

/**
 * Render the specified step: show/hide panels, update progress indicator,
 * and update navigation button visibility.
 */
function renderStep(stepNumber) {
  // Show/hide step panels
  for (var i = 1; i <= TOTAL_STEPS; i++) {
    var panel = document.getElementById("step-" + i);
    if (panel) {
      if (i === stepNumber) {
        panel.classList.add("active");
      } else {
        panel.classList.remove("active");
      }
    }
  }

  // Update progress indicator steps and connectors
  var progressSteps = document.querySelectorAll(".checkout-progress-step");
  progressSteps.forEach(function(stepEl) {
    var stepNum = parseInt(stepEl.getAttribute("data-step"), 10);
    stepEl.classList.remove("active", "completed");
    if (stepNum === stepNumber) {
      stepEl.classList.add("active");
    } else if (stepNum < stepNumber) {
      stepEl.classList.add("completed");
    }
  });

  var connectors = document.querySelectorAll(".checkout-progress-connector");
  connectors.forEach(function(conn) {
    var connNum = parseInt(conn.getAttribute("data-connector"), 10);
    if (connNum < stepNumber) {
      conn.classList.add("completed");
    } else {
      conn.classList.remove("completed");
    }
  });

  // Update navigation buttons
  var btnBack = document.getElementById("btn-back");
  var btnNext = document.getElementById("btn-next");
  var btnConfirm = document.getElementById("btn-confirm");

  if (btnBack) {
    if (stepNumber === 1) {
      btnBack.style.display = "inline-flex";
      btnBack.textContent = "\u2190 Back to Cart";
    } else {
      btnBack.style.display = "inline-flex";
      btnBack.textContent = "\u2190 Back";
    }
  }
  if (btnNext) {
    btnNext.style.display = (stepNumber < TOTAL_STEPS) ? "inline-flex" : "none";
  }
  if (btnConfirm) {
    btnConfirm.style.display = (stepNumber === TOTAL_STEPS) ? "inline-flex" : "none";
  }

  // Render step-specific content
  switch (stepNumber) {
    case 1:
      renderCartReview();
      break;
    case 2:
      populateAddressForm();
      break;
    case 3:
      populatePaymentForm();
      break;
    case 4:
      renderOrderSummary();
      break;
  }

  updateCartButtonStates();
}

/**
 * Render the Cart Review step content (Step 1).
 */
function renderCartReview() {
  var cartItemsEl = document.getElementById("checkout-cart-items");
  var cartTotalEl = document.getElementById("checkout-cart-total");

  if (!cartItemsEl || !cartTotalEl) return;

  if (!checkoutState.cartItems || checkoutState.cartItems.length === 0) {
    cartItemsEl.innerHTML = '<div class="checkout-empty">' +
      '<span class="checkout-empty-icon">\uD83D\uDED2</span>' +
      '<span class="checkout-empty-text">Your cart is empty!</span>' +
      '</div>';
    cartTotalEl.innerHTML = "";
    return;
  }

  var total = 0;
  var html = '<div class="checkout-cart-list">';

  checkoutState.cartItems.forEach(function(item) {
    var lineTotal = item.price * item.quantity;
    total += lineTotal;

    html += '<div class="checkout-cart-item">' +
      '<div class="checkout-cart-item-info">' +
        '<div class="checkout-cart-item-name">' + escapeHtml(item.name) + '</div>' +
        '<div class="checkout-cart-item-meta">\u20B9' + formatPrice(item.price) + ' \u00D7 ' + item.quantity + '</div>' +
      '</div>' +
      '<div class="checkout-cart-item-total">\u20B9' + formatPrice(lineTotal) + '</div>' +
    '</div>';
  });

  html += '</div>';
  cartItemsEl.innerHTML = html;

  cartTotalEl.innerHTML = '<div class="checkout-cart-total">' +
    '<span class="checkout-cart-total-label">Cart Total</span>' +
    '<span class="checkout-cart-total-amount">\u20B9' + formatPrice(total) + '</span>' +
  '</div>';
}

/**
 * Render the Order Summary step content (Step 4).
 */
function renderOrderSummary() {
  var summaryEl = document.getElementById("order-summary-content");
  if (!summaryEl) return;

  var total = 0;
  var itemsHtml = '<div class="checkout-summary-section">' +
    '<div class="checkout-summary-heading">\uD83D\uDCE6 Items</div>';

  checkoutState.cartItems.forEach(function(item) {
    var lineTotal = item.price * item.quantity;
    total += lineTotal;
    itemsHtml += '<div class="checkout-summary-text">' +
      escapeHtml(item.name) + ' \u2014 \u20B9' + formatPrice(item.price) + ' \u00D7 ' + item.quantity + ' = \u20B9' + formatPrice(lineTotal) +
    '</div>';
  });

  itemsHtml += '</div>';

  // Address section
  var addr = checkoutState.deliveryAddress;
  var addressHtml = '<div class="checkout-summary-section">' +
    '<div class="checkout-summary-heading">\uD83D\uDCCD Delivery Address</div>' +
    '<div class="checkout-summary-text">' + escapeHtml(addr.street) + '</div>' +
    '<div class="checkout-summary-text">' + escapeHtml(addr.city) + ', ' + escapeHtml(addr.state) + ' \u2014 ' + escapeHtml(addr.pincode) + '</div>' +
    (addr.landmark ? '<div class="checkout-summary-text">Landmark: ' + escapeHtml(addr.landmark) + '</div>' : '') +
  '</div>';

  // Payment section
  var paymentHtml = '<div class="checkout-summary-section">' +
    '<div class="checkout-summary-heading">\uD83D\uDCB3 Payment Method</div>' +
    '<div class="checkout-summary-text">' +
      (checkoutState.paymentMethod === "UPI" ? "UPI \u2014 " + escapeHtml(checkoutState.paymentDetails.upiId) : "Cash on Delivery") +
    '</div>' +
  '</div>';

  // Total section
  var totalHtml = '<div class="checkout-summary-total">' +
    '<span class="checkout-summary-total-label">Order Total</span>' +
    '<span class="checkout-summary-total-amount">\u20B9' + formatPrice(total) + '</span>' +
  '</div>';

  summaryEl.innerHTML = itemsHtml + addressHtml + paymentHtml + totalHtml;
}

/* ─── FORM POPULATION ────────────────────────────────────────────────────── */

/**
 * Populate the address form fields from saved state (Step 2).
 */
function populateAddressForm() {
  var addr = checkoutState.deliveryAddress;
  var streetEl = document.getElementById("address-street");
  var cityEl = document.getElementById("address-city");
  var stateEl = document.getElementById("address-state");
  var pincodeEl = document.getElementById("address-pincode");
  var landmarkEl = document.getElementById("address-landmark");

  if (streetEl) streetEl.value = addr.street || "";
  if (cityEl) cityEl.value = addr.city || "";
  if (stateEl) stateEl.value = addr.state || "";
  if (pincodeEl) pincodeEl.value = addr.pincode || "";
  if (landmarkEl) landmarkEl.value = addr.landmark || "";
}

/**
 * Populate the payment form from saved state (Step 3).
 */
function populatePaymentForm() {
  var method = checkoutState.paymentMethod;
  var upiIdEl = document.getElementById("upi-id");

  // Reset all payment options
  var options = document.querySelectorAll(".checkout-payment-option");
  options.forEach(function(opt) { opt.classList.remove("selected"); });

  var codNote = document.getElementById("cod-note");
  var upiSection = document.getElementById("upi-section");

  if (codNote) codNote.style.display = "none";
  if (upiSection) upiSection.style.display = "none";

  if (method === "COD") {
    var codOption = document.getElementById("payment-option-cod");
    if (codOption) codOption.classList.add("selected");
    var codRadio = codOption ? codOption.querySelector('input[type="radio"]') : null;
    if (codRadio) codRadio.checked = true;
    if (codNote) codNote.style.display = "block";
  } else if (method === "UPI") {
    var upiOption = document.getElementById("payment-option-upi");
    if (upiOption) upiOption.classList.add("selected");
    var upiRadio = upiOption ? upiOption.querySelector('input[type="radio"]') : null;
    if (upiRadio) upiRadio.checked = true;
    if (upiSection) upiSection.style.display = "block";
    if (upiIdEl) upiIdEl.value = checkoutState.paymentDetails.upiId || "";
  }
}

/* ─── PAYMENT LISTENERS ──────────────────────────────────────────────────── */

/**
 * Set up click listeners on payment option divs.
 */
function setupPaymentListeners() {
  var options = document.querySelectorAll(".checkout-payment-option");
  options.forEach(function(optionEl) {
    optionEl.addEventListener("click", function() {
      // Remove selected from all
      options.forEach(function(o) { o.classList.remove("selected"); });
      // Add selected to clicked
      optionEl.classList.add("selected");

      // Check the hidden radio
      var radio = optionEl.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;

      var method = optionEl.getAttribute("data-method");
      checkoutState.paymentMethod = method;

      // Show/hide COD note and UPI section
      var codNote = document.getElementById("cod-note");
      var upiSection = document.getElementById("upi-section");

      if (codNote) codNote.style.display = (method === "COD") ? "block" : "none";
      if (upiSection) upiSection.style.display = (method === "UPI") ? "block" : "none";

      // Clear payment error
      clearFieldError("payment-method");
    });
  });
}

/* ─── FORM DATA CAPTURE ──────────────────────────────────────────────────── */

/**
 * Capture form data from the current step into checkoutState.
 */
function captureFormData() {
  var step = checkoutState.currentStep;

  if (step === 2) {
    var streetEl = document.getElementById("address-street");
    var cityEl = document.getElementById("address-city");
    var stateEl = document.getElementById("address-state");
    var pincodeEl = document.getElementById("address-pincode");
    var landmarkEl = document.getElementById("address-landmark");

    checkoutState.deliveryAddress = {
      street: streetEl ? streetEl.value.trim() : "",
      city: cityEl ? cityEl.value.trim() : "",
      state: stateEl ? stateEl.value.trim() : "",
      pincode: pincodeEl ? pincodeEl.value.trim() : "",
      landmark: landmarkEl ? landmarkEl.value.trim() : ""
    };
  }

  if (step === 3) {
    var upiIdEl = document.getElementById("upi-id");
    checkoutState.paymentDetails.upiId = upiIdEl ? upiIdEl.value.trim() : "";
  }
}

/* ─── VALIDATION ─────────────────────────────────────────────────────────── */

/**
 * Validate the current step before allowing navigation forward.
 * Returns true if valid, false otherwise.
 */
function validateCurrentStep() {
  var step = checkoutState.currentStep;

  if (step === 1) {
    return checkoutState.cartItems && checkoutState.cartItems.length > 0;
  }

  if (step === 2) {
    return validateAddressForm();
  }

  if (step === 3) {
    return validatePaymentForm();
  }

  return true;
}

/**
 * Validate address form fields (Step 2).
 */
function validateAddressForm() {
  var valid = true;
  var streetEl = document.getElementById("address-street");
  var cityEl = document.getElementById("address-city");
  var stateEl = document.getElementById("address-state");
  var pincodeEl = document.getElementById("address-pincode");

  // Capture current values
  captureFormData();

  var addr = checkoutState.deliveryAddress;

  // Street
  if (!addr.street || addr.street.length < 5) {
    showFieldError("street", "Street address must be at least 5 characters");
    valid = false;
  } else {
    clearFieldError("street");
  }

  // City
  if (!addr.city || addr.city.length < 2) {
    showFieldError("city", "City is required");
    valid = false;
  } else {
    clearFieldError("city");
  }

  // State
  if (!addr.state || addr.state.length < 2) {
    showFieldError("state", "State is required");
    valid = false;
  } else {
    clearFieldError("state");
  }

  // Pincode (6 digits for India)
  if (!addr.pincode || !/^\d{6}$/.test(addr.pincode)) {
    showFieldError("pincode", "Pincode must be exactly 6 digits");
    valid = false;
  } else {
    clearFieldError("pincode");
  }

  return valid;
}

/**
 * Validate payment form (Step 3).
 */
function validatePaymentForm() {
  var valid = true;

  captureFormData();

  if (!checkoutState.paymentMethod) {
    showFieldError("payment-method", "Please select a payment method");
    valid = false;
  } else {
    clearFieldError("payment-method");
  }

  if (checkoutState.paymentMethod === "UPI") {
    var upiId = checkoutState.paymentDetails.upiId;
    if (!upiId || !upiId.includes("@")) {
      showFieldError("upi-id", "Please enter a valid UPI ID (e.g. name@upi)");
      valid = false;
    } else {
      clearFieldError("upi-id");
    }
  }

  return valid;
}

/**
 * Show a field-level validation error.
 */
function showFieldError(fieldName, message) {
  var errorEl = document.getElementById("error-" + fieldName);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = "block";
  }
  // Add has-error class to parent form group
  if (errorEl && errorEl.parentElement) {
    errorEl.parentElement.classList.add("has-error");
  }
}

/**
 * Clear a field-level validation error.
 */
function clearFieldError(fieldName) {
  var errorEl = document.getElementById("error-" + fieldName);
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.style.display = "none";
  }
  if (errorEl && errorEl.parentElement) {
    errorEl.parentElement.classList.remove("has-error");
  }
}

/* ─── STATE PERSISTENCE ──────────────────────────────────────────────────── */

function preserveState() {
  SessionManager.save(checkoutState);
}

function restoreState() {
  var saved = SessionManager.load();
  if (saved) {
    checkoutState.currentStep = saved.currentStep || 1;
    checkoutState.deliveryAddress = saved.deliveryAddress || checkoutState.deliveryAddress;
    checkoutState.paymentMethod = saved.paymentMethod || null;
    checkoutState.paymentDetails = saved.paymentDetails || checkoutState.paymentDetails;
    // Don't restore cartItems — always fetch fresh from API
  }
}

/* ─── GEOLOCATION ────────────────────────────────────────────────────────── */

/**
 * Detect user's location and auto-fill address fields.
 */
function detectLocation() {
  var btn = document.getElementById("btn-use-location");
  var spinner = document.getElementById("location-spinner");

  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  if (btn) btn.disabled = true;
  if (spinner) spinner.style.display = "inline-block";

  navigator.geolocation.getCurrentPosition(
    function(position) {
      var lat = position.coords.latitude;
      var lng = position.coords.longitude;

      // Use reverse geocoding via a free API
      fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lng)
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data && data.address) {
            var a = data.address;
            var streetEl = document.getElementById("address-street");
            var cityEl = document.getElementById("address-city");
            var stateEl = document.getElementById("address-state");
            var pincodeEl = document.getElementById("address-pincode");

            if (streetEl && !streetEl.value) {
              streetEl.value = (a.road || a.neighbourhood || a.suburb || "").substring(0, 200);
            }
            if (cityEl && !cityEl.value) {
              cityEl.value = a.city || a.town || a.village || "";
            }
            if (stateEl && !stateEl.value) {
              stateEl.value = a.state || "";
            }
            if (pincodeEl && !pincodeEl.value) {
              pincodeEl.value = a.postcode || "";
            }
          }
        })
        .catch(function(err) {
          console.warn("Reverse geocoding failed:", err);
        })
        .finally(function() {
          if (btn) btn.disabled = false;
          if (spinner) spinner.style.display = "none";
        });
    },

    function(error) {
      console.warn("Geolocation error:", error);
      alert("Unable to detect location. Please enter your address manually.");
      if (btn) btn.disabled = false;
      if (spinner) spinner.style.display = "none";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

/* ─── ORDER SUBMISSION ───────────────────────────────────────────────────── */

/**
 * Submit the order to the Order Service API with retry logic.
 */
async function submitOrder() {
  var btnConfirm = document.getElementById("btn-confirm");
  var labelEl = btnConfirm ? btnConfirm.querySelector(".btn-confirm-label") : null;
  var spinnerEl = btnConfirm ? btnConfirm.querySelector(".btn-confirm-spinner") : null;

  // Validate final step
  if (!validateCurrentStep()) return;
  captureFormData();

  // Disable button, show spinner
  if (btnConfirm) btnConfirm.disabled = true;
  if (labelEl) labelEl.style.display = "none";
  if (spinnerEl) spinnerEl.style.display = "inline-block";

  var userId = getCheckoutUserId();
  var total = 0;
  checkoutState.cartItems.forEach(function(item) {
    total += item.price * item.quantity;
  });

  var orderPayload = {
    userId: userId,
    items: checkoutState.cartItems.map(function(item) {
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
      };
    }),
    totalAmount: total,
    deliveryAddress: checkoutState.deliveryAddress,
    paymentMethod: checkoutState.paymentMethod,
    paymentDetails: checkoutState.paymentMethod === "UPI" ? { upiId: checkoutState.paymentDetails.upiId } : {},
     idempotencyKey:
        Date.now().toString() +
        "-" +
        Math.random().toString(36).substring(2)
  };

  var maxRetries = 3;
  var attempt = 0;
  var success = false;
  var orderId = null;

  while (attempt < maxRetries && !success) {
    attempt++;
    try {
      var res = await fetch(CHECKOUT_API + "/orders/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + getIdToken()
        },
        body: JSON.stringify(orderPayload)
      });

      if (res.ok) {
        var data = await res.json();
        orderId = data.orderId || data.id || ("ORD-" + Date.now());
        success = true;
      } else if (res.status >= 500 && attempt < maxRetries) {
        // Retry on server errors
        await new Promise(function(resolve) { setTimeout(resolve, 1000 * attempt); });
      } else {
        var errBody = await res.json().catch(function() { return {}; });
        throw new Error(errBody.message || "Order submission failed (HTTP " + res.status + ")");
      }
    } catch (err) {
      if (attempt >= maxRetries) {
        // Show error and re-enable button
        if (btnConfirm) btnConfirm.disabled = false;
        if (labelEl) labelEl.style.display = "inline";
        if (spinnerEl) spinnerEl.style.display = "none";
        alert("Order failed: " + err.message + ". Please try again.");
        return;
      }
      await new Promise(function(resolve) { setTimeout(resolve, 1000 * attempt); });
    }
  }

  if (success) {
    handleOrderSuccess(orderId);
  }
}

/**
 * Handle successful order placement.
 */
function handleOrderSuccess(orderId) {
  // Clear session state
  SessionManager.clear();

  // Hide progress and nav
  var progressEl = document.getElementById("checkout-progress");
  var navEl = document.querySelector(".checkout-nav");
  if (progressEl) progressEl.style.display = "none";
  if (navEl) navEl.style.display = "none";

  // Hide all step panels
  for (var i = 1; i <= TOTAL_STEPS; i++) {
    var panel = document.getElementById("step-" + i);
    if (panel) panel.classList.remove("active");
  }

  // Show success in step-4 panel
  var step4 = document.getElementById("step-4");
  if (step4) {
    step4.classList.add("active");
    var content = step4.querySelector(".checkout-panel-card");
    if (content) {
      content.innerHTML = '<div class="checkout-success">' +
        '<span class="checkout-success-icon">\u2705</span>' +
        '<div class="checkout-success-title">Order Placed!</div>' +
        '<div class="checkout-success-order-id">Order ID: ' + escapeHtml(orderId) + '</div>' +
        '<button class="checkout-btn-next" onclick="window.location.href=\'index.html#orders\'" style="margin-top:24px;"><span>\uD83D\uDCE6 View Orders</span></button>' +
      '</div>';
    }
  }
}

/* ─── UTILITY FUNCTIONS ──────────────────────────────────────────────────── */

/**
 * Update button disabled states based on cart content.
 */
function updateCartButtonStates() {
  var btnNext = document.getElementById("btn-next");
  if (btnNext && checkoutState.currentStep === 1) {
    btnNext.disabled = !checkoutState.cartItems || checkoutState.cartItems.length === 0;
  }
}

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format a price value to a readable string.
 */
function formatPrice(value) {
  var num = Number(value);
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Get the ID token for authenticated API calls.
 */
function getIdToken() {
  try {
    var raw = localStorage.getItem("cognito_tokens");
    if (!raw) return "";
    var tokens = JSON.parse(raw);
    return tokens.id_token || "";
  } catch (e) {
    return "";
  }
}

/* ─── BOOT ───────────────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", initCheckout);
