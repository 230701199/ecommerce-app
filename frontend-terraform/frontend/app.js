const API = "https://o8kqf93jnf.execute-api.ap-southeast-1.amazonaws.com";
function getUserId() {
  const user = getCurrentUser();
  return user?.sub || "guest";
}

/* ===== COGNITO AUTH CONFIG START ===== */
// Auth logic is now handled by auth.js — this key remains for token storage compatibility
const COGNITO_STORAGE_KEY = "cognito_tokens";
let currentUser = null;
/* ===== COGNITO AUTH CONFIG END ===== */

let ALL_PRODUCTS = [];
let EDIT_PRODUCT_ID = null;

const CATEGORY_EMOJIS = {
  electronics: "⚡", fashion: "👗", clothing: "👕", shoes: "👟",
  books: "📚", food: "🍕", beauty: "💄", sports: "🏃", toys: "🎮",
  home: "🏠", garden: "🌿", health: "💊", default: "✨"
};

/* ===== COGNITO AUTH HELPERS START ===== */
// NOTE: decodeJwt, isTokenExpired, isAuthenticated, getCurrentUser,
//       getIdToken, isAdminUser, logout are all provided by auth.js
//       which is loaded BEFORE app.js in index.html.

/**
 * Update the header login/logout/user-info elements based on the
 * current session state. Called on page load and after any auth change.
 * @param {object|null} user
 */
function updateAuthUI(user) {
  const loginBtn  = document.getElementById("btn-login");
  const logoutBtn = document.getElementById("btn-logout");
  const userInfo  = document.getElementById("user-info");

  if (user && user.email) {
    if (loginBtn)  loginBtn.style.display  = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";
    if (userInfo) {
      userInfo.style.display = "inline-flex";
      userInfo.innerHTML = `
        <div class="user-email">${user.email}</div>
        <div class="user-name">${user.name}</div>
      `;
    }
    currentUser = user;
  } else {
    if (loginBtn)  loginBtn.style.display  = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userInfo)  userInfo.style.display  = "none";
    currentUser = null;
  }

  updateAdminOrdersVisibility();
}

function updateAdminOrdersVisibility() {
  const adminBtn = document.getElementById("nav-admin-orders");
  const isAdmin = isAdminUser();
  if (adminBtn) {
    adminBtn.style.display = isAdmin ? "inline-flex" : "none";
  }
}

/**
 * Navigate to login.html — replaces the old Hosted UI redirect.
 * Called by the Login button in index.html.
 */
function login() {
  window.location.href = "login.html";
}

/**
 * Initialise auth state from localStorage on page load.
 * Called only AFTER requireAuth() confirms the session is valid, so
 * by the time this runs getCurrentUser() is guaranteed to return a user.
 */
async function initializeAuthState() {
  const user = getCurrentUser();
  updateAuthUI(user);
}
/* ===== COGNITO AUTH HELPERS END ===== */

function getEmoji(category) {
  if (!category) return CATEGORY_EMOJIS.default;
  const key = category.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_EMOJIS)) {
    if (key.includes(k)) return v;
  }
  return CATEGORY_EMOJIS.default;
}

function showAlert(msg, type = "success") {
  const box = document.getElementById("alert-box");
  const el = document.createElement("div");
  el.className = "alert " + type;
  el.innerText = (type === "success" ? "✅  " : "❌  ") + msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function setNavActive(id) {
  document.querySelectorAll(".nav-buttons button").forEach(b => b.classList.remove("active-nav"));
  document.getElementById("nav-" + id).classList.add("active-nav");
}

function showProducts() { setActive("products-section"); setNavActive("products"); }
function showCart() { setActive("cart-section"); setNavActive("cart"); loadCart(); }
function showOrders() { setActive("orders-section"); setNavActive("orders"); loadOrders(); }
function showAdminOrders() {
  const isAdmin = isAdminUser();
  if (!isAdmin) {
    showAlert("Admin access required 🔒", "error");
    return;
  }
  setActive("admin-orders-section");
  setNavActive("admin-orders");
  loadAdminOrders();
}

function setActive(id) {
  document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

async function loadProducts() {
  const res = await fetch(API + "/products");
  const data = await res.json();
  document.getElementById("loader").style.display = "none";
  ALL_PRODUCTS = data.data || [];
  renderProducts(ALL_PRODUCTS);
  populateCategories(ALL_PRODUCTS);
}

function populateCategories(products) {
  const dropdown = document.getElementById("categoryFilter");
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  dropdown.innerHTML = `<option value="all">All Categories</option>`;
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = getEmoji(cat) + " " + cat;
    dropdown.appendChild(option);
  });
}

function renderProducts(products) {
  const grid = document.getElementById("product-grid");
  const isAdmin = isAdminUser();

  const addBtn = document.getElementById("add-product-btn");
  if (addBtn) addBtn.style.display = isAdmin ? "inline-flex" : "none";

  // ===== AUTH UPDATE START =====
  updateAuthUI(currentUser);
  // ===== AUTH UPDATE END =====

  // ===== TEST FEATURE START =====
  updateTestNavVisibility();
  // ===== TEST FEATURE END =====

  grid.innerHTML = "";
  products.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.animationDelay = (i * 0.05) + "s";
    div.style.animation = "slideUp 0.4s ease both";

    const outOfStock = p.stock === 0;
    const cartBtn = outOfStock
      ? `<button class="btn-cart out-of-stock" disabled><span>Out of Stock</span></button>`
      : `<button class="btn-cart" onclick="addToCart('${p.id}')"><span>+ Add to Cart</span></button>`;

    const stockBadge = isAdmin
      ? `<div class="card-stock${outOfStock ? ' out' : ''}">Stock: ${p.stock !== undefined ? p.stock : 'N/A'}</div>`
      : "";

    div.innerHTML = `
      <span class="card-emoji">${getEmoji(p.category)}</span>
      ${p.category ? `<span class="card-category">${p.category}</span>` : ""}
      <h3>${p.name}</h3>
      <div class="card-price">
        ${
         p.discount > 0
           ? `₹${p.finalPrice} <span style="text-decoration:line-through; font-size:14px; color:#888;">₹${p.price}</span>
            <div style="color:#00ffcc; font-size:14px;">${p.discount}% OFF</div>`
          : `₹${p.price}`
       }
</div>
      ${stockBadge}
      ${cartBtn}
      ${isAdmin ? `
      <button class="btn-delete-admin" onclick="deleteProduct('${p.id}')">🗑 Delete</button>
      <button class="btn-edit-admin" onclick="editProduct(${p.id})">✏️ Edit</button>
      ` : ""}
    `;
    grid.appendChild(div);
  });
}

function filterCategory(category) {
  if (category === "all") renderProducts(ALL_PRODUCTS);
  else renderProducts(ALL_PRODUCTS.filter(p => p.category === category));
}

function filterProducts() {
  const category = document.getElementById("categoryFilter").value;
  const searchVal = (document.getElementById("productSearchInput")?.value || "").toLowerCase().trim();

  let filtered = ALL_PRODUCTS;

  if (category !== "all") {
    filtered = filtered.filter(p => p.category === category);
  }

  if (searchVal) {
    filtered = filtered.filter(p => p.name && p.name.toLowerCase().includes(searchVal));
  }

  renderProducts(filtered);
}

async function addToCart(productId) {
  await fetch(API + "/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: getUserId(), productId, quantity: 1 })
  });
  showAlert("Added to cart! 🎉");
}

async function loadCart() {
  const res = await fetch(API + "/cart/" + getUserId());
  const data = await res.json();
  const cartDiv = document.getElementById("cart");

  if (!data.length) {
    cartDiv.innerHTML = `<div class="empty-state"><span class="big-emoji">🛒</span><p>Your cart is empty!</p></div>`;
    return;
  }

  let total = 0;
  cartDiv.innerHTML = data.map((item, i) => {
    const product = ALL_PRODUCTS.find(p => p.id == item.productId);
    const price = product ? product.price : 0;
    total += price * item.quantity;
    return `
      <div class="cart-item" style="animation-delay:${i*0.06}s">
        <div class="cart-emoji">${getEmoji(product?.category)}</div>
        <div class="cart-item-info">
          <h4>${product ? product.name : "Unknown Product"}</h4>
          <div class="item-price">₹${price} each</div>
        </div>
        <div class="qty-controls">
          <button onclick="changeQty('${item.productId}', -1)">−</button>
          <span>${item.quantity}</span>
          <button onclick="changeQty('${item.productId}', 1)">+</button>
        </div>
        <button class="btn-remove" onclick="removeItem('${item.productId}')">Remove</button>
      </div>
    `;
  }).join("") + `
    <div class="cart-footer">
      <div class="cart-footer-total">
        <div class="label">Total Amount</div>
        <div class="amount">₹${total}</div>
      </div>
      <button class="btn-order" onclick="placeOrder()"><span>🚀 Place Order Now</span></button>
    </div>
  `;
}

async function changeQty(productId, change) {
  if (change === 1) {
    await fetch(API + "/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: getUserId(), productId, quantity: 1 })
    });
  }

  if (change === -1) {
    const res = await fetch(API + "/cart/" + getUserId());
    const items = await res.json();
    const item = items.find(i => i.productId == productId);
    if (!item) return;
    if (item.quantity <= 1) return removeItem(productId);
    await fetch(API + "/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: getUserId(), productId, quantity: -1 })
    });
  }

  loadCart();
}

async function removeItem(productId) {
  await fetch(API + `/cart/${getUserId()}/${productId}`, { method: "DELETE" });
  loadCart();
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

async function loadOrders() {
  const res = await fetch(API + "/orders/" + getUserId());
  let data = await res.json();
  const orderDiv = document.getElementById("orders");

  if (!data.length) {
    orderDiv.innerHTML = `<div class="empty-state"><span class="big-emoji">📦</span><p>No orders yet!</p></div>`;
    return;
  }

  data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  orderDiv.innerHTML = data.map((order, i) => {
    const items = order.items.map(i => {
      const p = ALL_PRODUCTS.find(x => x.id == i.productId);
      return `<li>${getEmoji(p?.category)} ${p ? p.name : i.productId} &nbsp;×${i.quantity}</li>`;
    }).join("");
    return `
      <div class="order-card" style="animation-delay:${i*0.07}s">
        <div class="order-header">
          <div class="order-id">#${order.orderId.slice(-8).toUpperCase()}</div>
          <div class="order-status">${order.status}</div>
        </div>
        <div class="order-meta">
          <p><strong>Date</strong> ${formatDate(order.createdAt)}</p>
        </div>
        <div class="order-total">₹${order.totalAmount}</div>
        <ul class="order-items">${items}</ul>
      </div>
    `;
  }).join("");
}

async function placeOrder() {
  try {
    const res = await fetch(API + "/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: getUserId() })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || "Order failed ❌");
      return;
    }

    showAlert("Order placed successfully! 🎉");

    loadCart();
    loadProducts();
    showCart();

  } catch (err) {
    console.error(err);
    showAlert("Something went wrong ❌");
  }
}

/* ── ADD MODAL FUNCTIONS ── */
function openModal() {
  document.getElementById("modal-name").value = "";
  document.getElementById("modal-price").value = "";
  document.getElementById("modal-category").value = "";
  document.getElementById("modal-stock").value = "";
  document.getElementById("modal-description").value = "";
  document.getElementById("modal-overlay").classList.add("open");
  setTimeout(() => document.getElementById("modal-name").focus(), 100);
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("open");
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById("modal-overlay")) closeModal();
}

document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") {
    closeModal();
    closeEditModal();
  }
});

async function submitProduct() {
  const name = document.getElementById("modal-name").value.trim();
  const price = Number(document.getElementById("modal-price").value);
  const category = document.getElementById("modal-category").value.trim();
  const stock = Number(document.getElementById("modal-stock").value);
  const description = document.getElementById("modal-description").value.trim();
  
  if (!name || !price || !category) {
    showAlert("Please fill in all fields", "error");
    return;
  }

  const idToken = getIdToken();
  await fetch(API + "/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
    },
    body: JSON.stringify({ name, price, category, stock, description })
  });

  closeModal();
  showAlert("Product added 🚀");
  loadProducts();
}

async function deleteProduct(id) {
  console.log("Deleting ID:", id);

  const idToken = getIdToken();
  await fetch(API + "/products/" + Number(id), {
    method: "DELETE",
    ...(idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : {})
  });

  showAlert("Deleted");
  loadProducts();
}

/* ── EDIT MODAL FUNCTIONS ── */
function editProduct(id) {
  const p = ALL_PRODUCTS.find(x => x.id == id);
  if (!p) return;

  EDIT_PRODUCT_ID = id;

  document.getElementById("edit-modal-name").value = p.name || "";
  document.getElementById("edit-modal-price").value = p.price || "";
  document.getElementById("edit-modal-category").value = p.category || "";
  document.getElementById("edit-modal-stock").value = p.stock !== undefined ? p.stock : "";
  document.getElementById("edit-modal-description").value = p.description || "";
  document.getElementById("edit-modal-discount").value = p.discount || 0;

  document.getElementById("edit-modal-overlay").classList.add("open");
  setTimeout(() => document.getElementById("edit-modal-name").focus(), 100);
}

function closeEditModal() {
  document.getElementById("edit-modal-overlay").classList.remove("open");
  EDIT_PRODUCT_ID = null;
}

function handleEditOverlayClick(e) {
  if (e.target === document.getElementById("edit-modal-overlay")) closeEditModal();
}

async function submitEditProduct() {
  if (!EDIT_PRODUCT_ID) return;

  const name = document.getElementById("edit-modal-name").value.trim();
  const price = Number(document.getElementById("edit-modal-price").value);
  const category = document.getElementById("edit-modal-category").value.trim();
  const stock = Number(document.getElementById("edit-modal-stock").value);
  const description = document.getElementById("edit-modal-description").value.trim();
  const discount = document.getElementById("edit-modal-discount").value;
  if (!name || !price || !category) {
    showAlert("Please fill in all required fields", "error");
    return;
  }

  const idToken = getIdToken();
  await fetch(API + `/products/${EDIT_PRODUCT_ID}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
    },
    body: JSON.stringify({ name, price, category, stock, description,discount: Number(discount || 0) })
  });

  closeEditModal();
  showAlert("Product updated ✅");
  loadProducts();
}

/**
 * ── GUARDED APP STARTUP ──────────────────────────────────────────────────
 *
 * requireAuth() is called first. It will:
 *   - Resolve immediately if a valid id_token exists (synchronous fast path).
 *   - Attempt a silent token refresh if the token is expired but a
 *     refresh_token is stored (one network round-trip).
 *   - Redirect to login.html and never resolve if no session can be
 *     established (page navigation stops all further execution).
 *
 * Only when requireAuth() resolves do we update the UI and load products.
 * This guarantees the app NEVER renders in guest mode on index.html.
 */
(async function startApp() {
  const user = await requireAuth();   // gate: redirects to login.html if not authed
  updateAuthUI(user);                 // show correct header state immediately
  await loadProducts();               // then fetch and render the product grid
})();


/* ===== TEST FEATURE START ===== */
const TEST_USER = "test-user";
function updateTestNavVisibility() {
  const isAdmin = isAdminUser();
  const btn = document.getElementById("nav-test");
  if (btn) btn.style.display = isAdmin ? "inline-block" : "none";
}

// ── TEST PANEL: NAVIGATION ──
function showTest() {
  const isAdmin = isAdminUser();
  if (!isAdmin) {
    showAlert("Admin access required 🔒", "error");
    return;
  }
  setActive("test-section");
  setNavActive("test");
}

// ── TEST PANEL: OUTPUT HELPERS ──
let _testOutputLines = [];

function appendOutput(line, type = "info") {
  _testOutputLines.push({ line, type });
  const pre = document.getElementById("test-output");
  const span = document.createElement("span");
  span.className = "log-" + type;
  span.textContent = line + "\n";
  if (pre.textContent === "// Run a test or click \"Run All Tests\" to see output here...") {
    pre.innerHTML = "";
  }
  pre.appendChild(span);
  pre.scrollTop = pre.scrollHeight;
}

function clearOutput() {
  _testOutputLines = [];
  document.getElementById("test-output").innerHTML = "";
  document.getElementById("test-output").textContent = "// Output cleared. Ready for next run...";
  document.getElementById("test-summary").style.display = "none";
  document.getElementById("test-summary").innerHTML = "";
}

function showResult(data, label) {
  appendOutput("  ✔ " + (label || "Response") + ":", "success");
  appendOutput(JSON.stringify(data, null, 2), "json");
}

function showError(err, label) {
  appendOutput("  ✘ " + (label || "Error") + ": " + (err?.message || err), "error");
}

function setLoading(state) {
  const el = document.getElementById("test-loading");
  const btn = document.getElementById("btn-run-all");
  if (state) {
    el.classList.add("visible");
    btn.disabled = true;
  } else {
    el.classList.remove("visible");
    btn.disabled = false;
  }
}

// ── TEST PANEL: PRODUCT TESTS ──

async function testCreateProduct() {
  appendOutput("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "divider");
  appendOutput("🛍  TEST: Create Product", "section");
  appendOutput("  → POST /products", "info");

  try {
    const payload = {
      name: "[TEST] product",
      price: 1000,
      category: "test",
      stock: 5,
      description: "test product"
    };

    const idToken = getIdToken();
    appendOutput("  → Payload: " + JSON.stringify(payload), "info");

    const res = await fetch(API + "/products", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      showError({ message: data.error || "HTTP " + res.status }, "Create Product");
      return false;
    }

    showResult(data, "Product Created");

    const productId = data.data?.id;

    if (!productId) {
      appendOutput("⚠ Could not find product ID for cleanup", "error");
      return false;
    }

    appendOutput("  → DELETE /products/" + productId, "info");
    

    const delRes = await fetch(API + "/products/" + productId, {
      method: "DELETE",
      ...(idToken ? { headers: { Authorization: `Bearer ${idToken}` } } : {})
    });

    if (!delRes.ok) {
      appendOutput("⚠ Cleanup failed (manual delete may be needed)", "error");
    } else {
      appendOutput("✔ Test product cleaned up", "success");
    }

    return true;

  } catch (err) {
    showError(err, "Create Product");
    return false;
  }
}

async function testGetProducts() {
  appendOutput("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "divider");
  appendOutput("🛍  TEST: Get All Products", "section");
  appendOutput("  → GET /products", "info");
  try {
    const res = await fetch(API + "/products");
    const data = await res.json();

    if (!res.ok) {
      showError({ message: data.error || "HTTP " + res.status }, "Get Products");
      return false;
    }

    const count = (data.data || []).length;
    appendOutput("  ✔ Total products fetched: " + count, "success");
    showResult(data.data ? data.data.slice(0, 3) : data, "First 3 Products (preview)");
    return true;
  } catch (err) {
    showError(err, "Get Products");
    return false;
  }
}

// ── TEST PANEL: CART TESTS ──

async function testAddToCart() {
  appendOutput("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "divider");
  appendOutput("🛒  TEST: Add to Cart", "section");

  const product = ALL_PRODUCTS.find(p => p.stock > 0);
  if (!product) {
    appendOutput("  ⚠ No in-stock products to add to cart.", "error");
    return false;
  }

  appendOutput("  → POST /cart  (productId: " + product.id + ", name: " + product.name + ")", "info");

  try {
    const res = await fetch(API + "/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: TEST_USER,
        productId: String(product.id),
        quantity: 1
      })
    });

    const data = await res.json();

    if (!res.ok) {
      showError({ message: data.error || "HTTP " + res.status }, "Add to Cart");
      return false;
    }

    showResult(data, "Cart Response");
    return true;

  } catch (err) {
    showError(err, "Add to Cart");
    return false;
  }
}

async function testGetCart() {
  appendOutput("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "divider");
  appendOutput("🛒  TEST: Get Cart", "section");
  appendOutput("  → GET /cart/" + getUserId(), "info");

  try {
    const res = await fetch(API + "/cart/" + getUserId());
    const data = await res.json();

    if (!res.ok) {
      showError({ message: data.error || "HTTP " + res.status }, "Get Cart");
      return false;
    }

    const count = Array.isArray(data) ? data.length : "?";
    appendOutput("  ✔ Cart items: " + count, "success");
    showResult(data, "Cart Items");
    return true;
  } catch (err) {
    showError(err, "Get Cart");
    return false;
  }
}

// ── TEST PANEL: ORDER TESTS ──

async function testPlaceOrder() {
  appendOutput("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "divider");
  appendOutput("📦  TEST: Place Order", "section");
  appendOutput("  → POST /orders  (userId: " + TEST_USER + ")", "info");

  try {
    const res = await fetch(API + "/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: TEST_USER })
    });
    const data = await res.json();

    if (!res.ok) {
      showError({ message: data.error || "HTTP " + res.status }, "Place Order");
      return false;
    }

    showResult(data, "Order Response");
    await loadProducts();
    return true;
  } catch (err) {
    showError(err, "Place Order");
    return false;
  }
}

// ── TEST PANEL: RUN ALL ──

async function runAllTests() {
  const isAdmin = isAdminUser();
  if (!isAdmin) {
    showAlert("Admin access required 🔒", "error");
    return;
  }

  clearOutput();
  setLoading(true);

  const results = {};
  const timestamp = new Date().toLocaleString("en-IN");

  appendOutput("╔══════════════════════════════════════════╗", "section");
  appendOutput("║       🧪 NEXMART — FULL TEST SUITE       ║", "section");
  appendOutput("╚══════════════════════════════════════════╝", "section");
  appendOutput("  Started: " + timestamp, "info");
  appendOutput("", "info");

  appendOutput("▶ PRODUCT TESTS", "section");
  results.createProduct  = await testCreateProduct();
  results.getProducts    = await testGetProducts();

  appendOutput("", "info");

  appendOutput("▶ CART TESTS", "section");
  results.addToCart = await testAddToCart();
  results.getCart   = await testGetCart();

  appendOutput("", "info");

  appendOutput("▶ ORDER TESTS", "section");
  results.placeOrder = await testPlaceOrder();

  appendOutput("", "info");

  const passed = Object.values(results).filter(Boolean).length;
  const failed = Object.values(results).filter(v => v === false).length;
  const total  = Object.keys(results).length;

  appendOutput("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "divider");
  appendOutput("📊  RESULTS SUMMARY", "section");
  appendOutput("  ✔ Passed: " + passed + "/" + total, "success");
  if (failed > 0) {
    appendOutput("  ✘ Failed: " + failed + "/" + total, "error");
  }
  appendOutput("  Finished: " + new Date().toLocaleString("en-IN"), "info");
  appendOutput("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "divider");

  const summaryEl = document.getElementById("test-summary");
  summaryEl.style.display = "flex";
  summaryEl.innerHTML = `
    <span class="test-badge total">🧪 Total: ${total}</span>
    <span class="test-badge pass">✔ Passed: ${passed}</span>
    ${failed > 0 ? `<span class="test-badge fail">✘ Failed: ${failed}</span>` : ""}
  `;

  setLoading(false);
  showAlert(failed === 0 ? "All tests passed! 🎉" : failed + " test(s) failed ⚠️", failed === 0 ? "success" : "error");
}

// Init test nav visibility on page load
updateTestNavVisibility();

/* ===== TEST FEATURE END ===== */

async function loadAdminOrders() {
  const tbody = document.getElementById("admin-orders-list");
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">// Fetching orders...</td></tr>`;

  try {
    const idToken = getIdToken();
    const res = await fetch(API + "/admin/orders", {
      headers: {
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
      }
    });

    const data = await res.json();

    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ff7096;">Failed to load admin orders: ${data.error || "Unknown Error"}</td></tr>`;
      return;
    }

    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No orders found in NexMart.</td></tr>`;
      return;
    }

    // Sort orders by date descending
    data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    tbody.innerHTML = data.map((order, i) => {
      const orderIdShort = order.orderId.slice(-8).toUpperCase();
      const formattedDate = formatDate(order.createdAt);
      const statuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"];

      const options = statuses.map(s => 
        `<option value="${s}" ${order.status === s ? "selected" : ""}>${s}</option>`
      ).join("");

      return `
        <tr style="animation-delay:${i * 0.05}s; animation: slideUp 0.3s ease both;">
          <td style="font-family:var(--font-mono); color:#70e8ff;">#${orderIdShort}</td>
          <td>${order.email}</td>
          <td style="color:#ff5577; font-weight:700;">₹${order.totalAmount}</td>
          <td>
            <select id="status-select-${order.orderId}">
              ${options}
            </select>
          </td>
          <td>${formattedDate}</td>
          <td>
            <button class="btn-save-status" onclick="updateOrderStatus('${order.orderId}')">Save</button>
          </td>
        </tr>
      `;
    }).join("");

  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ff7096;">Something went wrong ❌</td></tr>`;
  }
}

async function updateOrderStatus(orderId) {
  const select = document.getElementById(`status-select-${orderId}`);
  const newStatus = select.value;
  const idToken = getIdToken();

  try {
    const res = await fetch(API + `/admin/orders/${orderId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify({ status: newStatus })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || "Update failed ❌", "error");
      return;
    }

    showAlert("Order status updated! 🎉");
    loadAdminOrders();
  } catch (err) {
    console.error(err);
    showAlert("Something went wrong ❌", "error");
  }
}
