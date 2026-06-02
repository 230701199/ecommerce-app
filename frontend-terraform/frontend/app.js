const API = "https://o8kqf93jnf.execute-api.ap-southeast-1.amazonaws.com";
function getUserId() {
  const user = getCurrentUser();
  return user?.sub || "guest";
}

/* ===== COGNITO AUTH CONFIG START ===== */
const COGNITO_DOMAIN = "https://ap-southeast-1pwak67usw.auth.ap-southeast-1.amazoncognito.com";
const COGNITO_CLIENT_ID = "2qv50999jltmlrfm3tria2kqcf";
const COGNITO_REDIRECT_URI = "https://d32dvut05ll57l.cloudfront.net";
const COGNITO_SCOPES = "openid profile email";
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
function generateCodeVerifier() {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < 128; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

function generateState() {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

function base64UrlEncode(uint8array) {
  const binaryString = String.fromCharCode.apply(null, uint8array);
  return btoa(binaryString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
  const hash = await sha256(verifier);
  return base64UrlEncode(hash);
}

function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error("Invalid JWT");
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch (err) {
    console.error("JWT decode error:", err);
    return null;
  }
}

function isTokenExpired(token) {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

function isAuthenticated() {
  const tokenStr = localStorage.getItem(COGNITO_STORAGE_KEY);
  if (!tokenStr) return false;
  try {
    const tokens = JSON.parse(tokenStr);
    return tokens.id_token && !isTokenExpired(tokens.id_token);
  } catch {
    return false;
  }
}

function getCurrentUser() {
  const tokenStr = localStorage.getItem(COGNITO_STORAGE_KEY);
  if (!tokenStr) return null;
  try {
    const tokens = JSON.parse(tokenStr);
    const payload = decodeJwt(tokens.id_token);
    if (!payload) return null;
    return {
      email: payload.email || "User",
      name: payload.name || payload['cognito:username'] || "User",
      sub: payload.sub,
      groups: payload['cognito:groups'] || []
    };
  } catch {
    return null;
  }
}

function getIdToken() {
  const tokenStr = localStorage.getItem(COGNITO_STORAGE_KEY);
  if (!tokenStr) return null;

  try {
    const tokens = JSON.parse(tokenStr);
    return tokens.id_token;
  } catch {
    return null;
  }
}

function isAdminUser() {
  const user = getCurrentUser();
  return user && user.groups && user.groups.includes("admin");
}

function updateAuthUI(user) {
  const loginBtn = document.getElementById("btn-login");
  const logoutBtn = document.getElementById("btn-logout");
  const userInfo = document.getElementById("user-info");

  if (user && user.email) {
    if (loginBtn) loginBtn.style.display = "none";
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
    if (loginBtn) loginBtn.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userInfo) userInfo.style.display = "none";
    currentUser = null;
  }
}

async function login() {
  try {
    const codeVerifier = generateCodeVerifier();
    const state = generateState();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    sessionStorage.setItem("cognito_code_verifier", codeVerifier);
    sessionStorage.setItem("cognito_state", state);

    const authorizeUrl = 
      `${COGNITO_DOMAIN}/oauth2/authorize` +
      `?response_type=code` +
      `&client_id=${encodeURIComponent(COGNITO_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(COGNITO_REDIRECT_URI)}` +
      `&scope=${encodeURIComponent(COGNITO_SCOPES)}` +
      `&state=${encodeURIComponent(state)}` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}` +
      `&code_challenge_method=S256`;

    window.location.href = authorizeUrl;
  } catch (err) {
    console.error("Login error:", err);
    showAlert("Login failed ❌", "error");
  }
}

function logout() {
  try {
    localStorage.removeItem(COGNITO_STORAGE_KEY);
    sessionStorage.removeItem("cognito_code_verifier");
    sessionStorage.removeItem("cognito_state");
    currentUser = null;
    updateAuthUI(null);

    const logoutUrl = 
      `${COGNITO_DOMAIN}/logout` +
      `?client_id=${encodeURIComponent(COGNITO_CLIENT_ID)}` +
      `&logout_uri=${encodeURIComponent(COGNITO_REDIRECT_URI)}`;

    showAlert("Logged out successfully 👋", "success");
    setTimeout(() => {
      window.location.href = logoutUrl;
    }, 500);
  } catch (err) {
    console.error("Logout error:", err);
    showAlert("Logout failed ❌", "error");
  }
}

async function handleRedirectCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const state = urlParams.get("state");
  const error = urlParams.get("error");

  if (error) {
    console.error("OAuth error:", error, urlParams.get("error_description"));
    showAlert("Authentication failed: " + error, "error");
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  if (!code) {
    initializeAuthState();
    return;
  }

  try {
    const storedState = sessionStorage.getItem("cognito_state");
    const storedVerifier = sessionStorage.getItem("cognito_code_verifier");

    if (!storedState || state !== storedState) {
      throw new Error("State mismatch - CSRF detected");
    }

    if (!storedVerifier) {
      throw new Error("Code verifier not found");
    }

    const tokenUrl = `${COGNITO_DOMAIN}/oauth2/token`;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: COGNITO_CLIENT_ID,
      code: code,
      redirect_uri: COGNITO_REDIRECT_URI,
      code_verifier: storedVerifier
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || data.error || "Token exchange failed");
    }

    const idTokenPayload = decodeJwt(data.id_token);
    const expiresAt = (idTokenPayload.exp * 1000) + (5 * 60 * 1000);

    const tokenData = {
      id_token: data.id_token,
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      expires_at: expiresAt,
      token_type: "Bearer"
    };

    localStorage.setItem(COGNITO_STORAGE_KEY, JSON.stringify(tokenData));
    sessionStorage.removeItem("cognito_code_verifier");
    sessionStorage.removeItem("cognito_state");

    window.history.replaceState({}, document.title, window.location.pathname);

    const user = getCurrentUser();
    updateAuthUI(user);
    showAlert(`Welcome ${user.name}! 🎉`, "success");

  } catch (err) {
    console.error("Token exchange error:", err);
    showAlert("Authentication error: " + err.message, "error");
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function initializeAuthState() {
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

handleRedirectCallback();
loadProducts();


/* ===== TEST FEATURE START ===== */

// ── TEST PANEL: NAV VISIBILITY ──
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
    const idToken = getIdToken();

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
