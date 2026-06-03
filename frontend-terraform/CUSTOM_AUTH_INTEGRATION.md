# Custom Authentication UI — Integration Guide

## Overview

This guide explains how to integrate the **fully custom Cognito authentication system** into your existing NexMart application. The new system replaces the Cognito Hosted UI with custom login, signup, and email verification pages while keeping AWS Cognito as the backend identity provider.

---

## What's New?

### Files Created

1. **`auth.js`** — Core authentication library
   - Implements Cognito User Pool APIs directly (no Hosted UI)
   - Provides: `signIn()`, `signUp()`, `confirmSignUp()`, `logout()`, `refreshSession()`
   - Exposes helpers: `isAuthenticated()`, `getCurrentUser()`, `getIdToken()`, `isAdminUser()`
   - Handles JWT decoding, token storage, and session management

2. **`auth.css`** — Styling for authentication pages
   - Extends the existing cyberpunk/neon theme from `styles.css`
   - Responsive card-based layout with animated backgrounds
   - Password strength indicator, validation hints, loading spinners

3. **`login.html`** — Sign-in page
   - Email + password fields
   - Show/hide password toggle
   - Auto-redirects to `index.html` if already authenticated
   - Redirects unverified users to `verify.html`

4. **`signup.html`** — Registration page
   - Email + password + confirm password fields
   - Real-time password strength meter
   - Cognito password policy checklist (8+ chars, uppercase, lowercase, number, symbol)
   - Sends verification code via email on success

5. **`verify.html`** — Email verification page
   - 6-digit OTP input
   - Pre-fills email from `sessionStorage` (set by signup flow)
   - Resend code button with 60-second cooldown timer

---

## What Changed?

### `app.js` Modifications

**Before:**
- Used OAuth2 PKCE flow with Cognito Hosted UI
- `login()` redirected to `https://ap-southeast-1pwak67usw.auth.ap-southeast-1.amazoncognito.com/oauth2/authorize`
- `logout()` redirected to Cognito's logout endpoint
- `handleRedirectCallback()` exchanged authorization code for tokens

**After:**
- `login()` now redirects to `login.html`
- `logout()` clears tokens and redirects to `login.html` (no Cognito logout URL)
- Removed all PKCE helpers (code verifier, challenge, state)
- Removed OAuth2 token exchange logic
- Auth functions (`isAuthenticated`, `getCurrentUser`, `getIdToken`, `isAdminUser`) are now provided by `auth.js`
- Added `initializeAuthState()` to restore session on page load

**Key functions preserved:**
- `updateAuthUI(user)` — still updates header UI
- `isAdminUser()` — still checks for "admin" group in JWT
- All product/cart/order logic remains **unchanged**

### `index.html` Modifications

**Before:**
```html
<script src="app.js"></script>
```

**After:**
```html
<script src="auth.js"></script>
<script src="app.js"></script>
```

**Why?** `app.js` now depends on `auth.js` functions (`isAuthenticated`, `getCurrentUser`, etc.), so `auth.js` must load first.

---

## Cognito Configuration

The custom auth system connects to your existing User Pool using these credentials:

```javascript
// auth.js configuration
const AUTH_CONFIG = {
  region:      "ap-southeast-1",
  userPoolId:  "ap-southeast-1_Pwak67UsW",
  clientId:    "2qv50999jltmlrfm3tria2kqcf",
  endpoint:    "https://cognito-idp.ap-southeast-1.amazonaws.com/",
  storageKey:  "cognito_tokens"  // same key used by app.js
};
```

### Required Cognito App Client Settings

Your app client (`2qv50999jltmlrfm3tria2kqcf`) **must** allow:

1. **Auth Flow:** `USER_PASSWORD_AUTH` (enable in User Pool → App clients → Edit)
2. **Password Policy:** At least 8 characters, uppercase, lowercase, number, symbol
3. **Email Verification:** Required attribute (already configured)

#### How to Enable USER_PASSWORD_AUTH

1. Go to AWS Console → Cognito → User Pools → `ap-southeast-1_Pwak67UsW`
2. Click **App clients** → Select your client `2qv50999jltmlrfm3tria2kqcf`
3. Scroll to **Authentication flows** → Check **ALLOW_USER_PASSWORD_AUTH**
4. Save changes

**Without this setting, login will fail with:**
```
InvalidParameterException: USER_PASSWORD_AUTH flow not enabled for this client
```

---

## Token Storage

Both the old and new auth systems use the **same localStorage key**: `cognito_tokens`

### Stored Token Structure

```json
{
  "id_token":      "eyJraWQiOiJ...",
  "access_token":  "eyJraWQiOiJ...",
  "refresh_token": "eyJjdHkiOiJ...",
  "expires_at":    1704067200000,
  "token_type":    "Bearer"
}
```

This ensures seamless compatibility — your API Gateway JWT Authorizer validates `id_token` exactly as before.

---

## User Flows

### 1️⃣ Signup Flow

```
signup.html
  ↓ User enters email + password
  ↓ signUp(email, password) → Cognito SignUp API
  ↓ Cognito sends 6-digit code to email
  ↓ Store email in sessionStorage
  ↓ Redirect to verify.html
```

### 2️⃣ Verification Flow

```
verify.html
  ↓ Email pre-filled from sessionStorage
  ↓ User enters 6-digit code
  ↓ confirmSignUp(email, code) → Cognito ConfirmSignUp API
  ↓ Redirect to login.html
```

### 3️⃣ Login Flow

```
login.html
  ↓ User enters email + password
  ↓ signIn(email, password) → Cognito InitiateAuth API
  ↓ Receive id_token, access_token, refresh_token
  ↓ Store tokens in localStorage
  ↓ Redirect to index.html
```

### 4️⃣ Session Restore

```
index.html loads
  ↓ auth.js loaded → defines auth functions
  ↓ app.js loaded → calls initializeAuthState()
  ↓ Check if id_token exists and not expired
  ↓   YES → updateAuthUI(user)
  ↓   NO  → Try refreshSession() with refresh_token
  ↓         SUCCESS → updateAuthUI(user)
  ↓         FAIL    → Show login button (user can continue as guest)
```

**Note:** Unlike the Hosted UI flow, users are **not forcibly redirected** to login. They can browse products as guests. Protected actions (admin features, placing orders) still require auth.

### 5️⃣ Logout Flow

```
User clicks Logout button
  ↓ logout() in auth.js
  ↓ localStorage.removeItem("cognito_tokens")
  ↓ Redirect to login.html
```

---

## API Integration

### JWT Authorization (Unchanged)

Your API Gateway HTTP API still validates the `id_token` using the Cognito JWT Authorizer.

**Protected endpoints** (e.g., `POST /products`, `PUT /products/{id}`, `DELETE /products/{id}`):

```javascript
const idToken = getIdToken();  // from auth.js

await fetch(API + "/products", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`
  },
  body: JSON.stringify({ name, price, category })
});
```

**Admin checks** (client-side UI gating):

```javascript
if (isAdminUser()) {
  // Show "Add Product" button, "Edit", "Delete", "Test Panel"
}
```

The `admin` group membership is extracted from the `cognito:groups` claim in the id_token.

---

## Deployment

### Terraform Changes

The `main.tf` file now includes five new S3 objects:

```hcl
resource "aws_s3_object" "auth_js"      { key = "auth.js"      }
resource "aws_s3_object" "auth_css"     { key = "auth.css"     }
resource "aws_s3_object" "login_html"   { key = "login.html"   }
resource "aws_s3_object" "signup_html"  { key = "signup.html"  }
resource "aws_s3_object" "verify_html"  { key = "verify.html"  }
```

### Deploy Steps

```bash
cd frontend-terraform/terraform

# Initialize (if not already done)
terraform init

# Preview changes
terraform plan

# Apply changes
terraform apply
```

Terraform will:
1. Upload the 5 new files to S3
2. Update `index.html` and `app.js` (etag changed → CloudFront cache invalidation recommended)

### CloudFront Cache Invalidation (Recommended)

After deployment, invalidate CloudFront cache to serve the updated files immediately:

```bash
aws cloudfront create-invalidation \
  --distribution-id <YOUR_DISTRIBUTION_ID> \
  --paths "/*" \
  --profile idp-sbx-trn-lab-01
```

Or via AWS Console: CloudFront → Distributions → Select distribution → Invalidations → Create → Path: `/*`

---

## Testing Checklist

### 1. Signup

- [ ] Go to `https://<cloudfront-domain>/signup.html`
- [ ] Enter email (use a real email you can access)
- [ ] Enter password meeting all 5 policy requirements (green checkmarks)
- [ ] Confirm password matches
- [ ] Click "Create Account"
- [ ] Verify success message: "Account created! Check your email for the code…"
- [ ] Redirects to `verify.html` after 1 second

### 2. Email Verification

- [ ] Check inbox (and spam) for AWS Cognito email with 6-digit code
- [ ] Email field pre-filled on `verify.html`
- [ ] Enter 6-digit code
- [ ] Click "Verify Account"
- [ ] Success message: "Email verified! Redirecting to login…"
- [ ] Redirects to `login.html` after 1.2 seconds

### 3. Login

- [ ] Enter verified email
- [ ] Enter password
- [ ] Click "Sign In"
- [ ] Success message: "Signed in! Redirecting…"
- [ ] Redirects to `index.html`
- [ ] Header shows user email and name
- [ ] "Logout" button visible, "Login" button hidden

### 4. Session Persistence

- [ ] After logging in, refresh `index.html`
- [ ] User remains logged in (no redirect to login)
- [ ] Header still shows user info

### 5. Logout

- [ ] Click "Logout" button
- [ ] Redirects to `login.html`
- [ ] Go back to `index.html`
- [ ] Header shows "Login" button (user logged out)

### 6. Admin Features (if user is in "admin" group)

- [ ] After login, "🧪 Test" button visible in header
- [ ] "➕ Add Product" button visible on Products page
- [ ] "✏️ Edit" and "🗑 Delete" buttons visible on each product card

### 7. Unverified Account Handling

- [ ] Create a new account but **do not** verify
- [ ] Try to log in with unverified email
- [ ] Error: "Account not verified. Redirecting to verify…"
- [ ] Redirects to `verify.html`
- [ ] Resend code works (check email again)

### 8. Error Handling

- [ ] **Login with wrong password:** "Incorrect email or password."
- [ ] **Login with non-existent email:** "No account found with that email."
- [ ] **Signup with existing email:** "An account with this email already exists."
- [ ] **Signup with weak password:** "Password does not meet requirements."
- [ ] **Verify with wrong code:** "That verification code is incorrect. Please try again."
- [ ] **Verify with expired code:** "The verification code has expired. Request a new one."

---

## Security Notes

### What Doesn't Change

- **JWT Validation:** Still done server-side by API Gateway
- **Token Signing:** Cognito still signs JWTs with RS256
- **Refresh Tokens:** Still used for silent session renewal
- **User Pool Security:** All password hashing, MFA support (if enabled), account lockout policies remain intact

### What Changes

- **No OAuth2 PKCE:** The new flow uses direct Cognito API calls (InitiateAuth with USER_PASSWORD_AUTH) instead of OAuth2 authorization code flow
- **No Hosted UI:** Users never see `cognito-idp.ap-southeast-1.amazonaws.com` in the browser
- **Client-Side Token Storage:** Tokens still stored in `localStorage` (same as before — consider `httpOnly` cookies + backend proxy for production)

### Production Recommendations

1. **HTTPS Only:** Ensure CloudFront enforces HTTPS (already configured via `viewer_protocol_policy = "redirect-to-https"`)
2. **Content Security Policy (CSP):** Add CSP headers to block XSS attacks
3. **Token Theft Mitigation:** Consider moving tokens to `httpOnly` cookies via a backend proxy instead of `localStorage`
4. **MFA:** Enable Multi-Factor Authentication in Cognito for high-security accounts
5. **Rate Limiting:** Add CloudFront + WAF rules to prevent brute-force login attempts

---

## Troubleshooting

### "USER_PASSWORD_AUTH flow not enabled for this client"

**Solution:** Enable `ALLOW_USER_PASSWORD_AUTH` in Cognito App Client settings (see [Required Cognito App Client Settings](#required-cognito-app-client-settings))

### "Password must be at least 8 characters…"

**Cause:** Password doesn't meet Cognito policy (uppercase, lowercase, number, symbol)

**Solution:** Use the policy checklist on `signup.html` to ensure all 5 requirements turn green

### Login button redirects to Hosted UI instead of login.html

**Cause:** Old `app.js` cached in browser or CloudFront

**Solution:**
1. Hard refresh: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
2. Invalidate CloudFront cache (see [CloudFront Cache Invalidation](#cloudfront-cache-invalidation-recommended))

### Tokens expire immediately after login

**Cause:** System clock skew or token expiry calculation issue

**Solution:** Check browser DevTools → Application → Local Storage → Verify `expires_at` timestamp is in the future

### Auth functions undefined (e.g., `isAuthenticated is not defined`)

**Cause:** `auth.js` not loaded or loaded after `app.js`

**Solution:** Verify `index.html` loads `<script src="auth.js"></script>` **before** `<script src="app.js"></script>`

---

## Rollback Instructions

If you need to revert to the Cognito Hosted UI:

1. **Restore old `app.js`:**
   ```bash
   git checkout HEAD~1 frontend-terraform/frontend/app.js
   ```

2. **Restore old `index.html`:**
   ```bash
   git checkout HEAD~1 frontend-terraform/frontend/index.html
   ```

3. **Remove new files from Terraform:**
   Delete the 5 new `aws_s3_object` resources from `main.tf`

4. **Redeploy:**
   ```bash
   terraform apply
   ```

5. **Invalidate CloudFront cache**

---

## Summary

| Feature | Before (Hosted UI) | After (Custom UI) |
|---------|-------------------|-------------------|
| **Login UX** | Redirects to Cognito domain | Custom login.html |
| **Signup UX** | Redirects to Cognito domain | Custom signup.html |
| **Verification** | Handled by Hosted UI | Custom verify.html |
| **Theme** | Cognito default (can customize with CSS in advanced settings) | Full cyberpunk/neon theme |
| **Auth Flow** | OAuth2 PKCE | USER_PASSWORD_AUTH |
| **Token Storage** | localStorage (same key) | localStorage (same key) |
| **JWT Validation** | API Gateway authorizer | API Gateway authorizer (no change) |
| **Session Refresh** | OAuth2 refresh_token grant | Cognito InitiateAuth with REFRESH_TOKEN_AUTH |
| **Admin Detection** | cognito:groups claim | cognito:groups claim (no change) |

**Result:** Fully branded authentication experience with **zero** Cognito UI visibility, while keeping all backend security and existing API integrations intact.

---

## Support

If you encounter issues not covered in this guide:

1. Check browser DevTools console for JavaScript errors
2. Verify Cognito App Client has `USER_PASSWORD_AUTH` enabled
3. Confirm all 5 new files uploaded to S3 and accessible via CloudFront
4. Test with a real email address (Cognito won't send verification codes to invalid emails)

For Cognito-specific errors, refer to: [AWS Cognito Error Reference](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/CommonErrors.html)
