# Custom Auth — Quick Reference

## 🚀 For Developers

### Key Functions (auth.js)

```javascript
// Authentication
await signIn(email, password)          // Returns user object
await signUp(email, password)          // Sends verification code
await confirmSignUp(email, code)       // Verifies account
await resendVerificationCode(email)    // Resends code

// Session Management
isAuthenticated()                      // true if valid session
getCurrentUser()                       // { email, name, sub, groups }
getIdToken()                           // Bearer token for API calls
isAdminUser()                          // true if user in "admin" group
await refreshSession()                 // Silent token refresh
logout()                               // Clear session + redirect to login

// Token Storage (localStorage key: "cognito_tokens")
{
  id_token:      "eyJ...",  // Used by API Gateway authorizer
  access_token:  "eyJ...",
  refresh_token: "eyJ...",
  expires_at:    1704067200000,
  token_type:    "Bearer"
}
```

### UI Helper (app.js)

```javascript
updateAuthUI(user)  // Updates header login/logout/user-info elements
```

### Making Authenticated API Calls

```javascript
const idToken = getIdToken();

const response = await fetch(API + "/endpoint", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${idToken}`  // API Gateway validates this
  },
  body: JSON.stringify({ data })
});
```

---

## 📋 User Flows

### New User Registration

1. Visit `signup.html`
2. Enter email + password (8+ chars, uppercase, lowercase, number, symbol)
3. Cognito sends 6-digit code to email
4. Redirected to `verify.html`
5. Enter code → account verified
6. Redirected to `login.html`
7. Sign in → redirected to `index.html`

### Existing User Login

1. Visit `login.html` (or click "Login" on index.html)
2. Enter email + password
3. Redirected to `index.html` with active session

### Session Refresh (Automatic)

- When `index.html` loads, `initializeAuthState()` checks for valid tokens
- If `id_token` expired but `refresh_token` valid → silent refresh
- If both expired → user sees "Login" button (can still browse as guest)

### Logout

- Click "Logout" button
- Tokens cleared from localStorage
- Redirected to `login.html`

---

## 🧪 Testing Commands

### Check Current Session (Browser Console)

```javascript
isAuthenticated()     // Should return true if logged in
getCurrentUser()      // Shows user email, name, sub, groups
getIdToken()          // Shows JWT token
isAdminUser()         // Should return true for admin users
```

### Decode JWT Manually

```javascript
const payload = decodeJwt(getIdToken());
console.log(payload);

// Expected structure:
// {
//   sub: "abc-123-def-456",
//   email: "user@example.com",
//   "cognito:username": "user@example.com",
//   "cognito:groups": ["admin"],  // if user is admin
//   exp: 1704067200,
//   iat: 1704063600,
//   ...
// }
```

### Test Token Refresh

```javascript
// Force token refresh (even if not expired)
await refreshSession();
console.log("Refreshed:", getCurrentUser());
```

### Clear Session (Logout)

```javascript
logout();  // Clears tokens + redirects to login.html
```

---

## 🔧 Cognito Configuration

### Required App Client Settings

1. Go to AWS Console → Cognito → User Pools → `ap-southeast-1_Pwak67UsW`
2. App clients → Select `2qv50999jltmlrfm3tria2kqcf`
3. **Enable:** `ALLOW_USER_PASSWORD_AUTH`
4. **Disable:** App client secret (public client)
5. **Password Policy:**
   - Minimum length: 8
   - Require uppercase
   - Require lowercase
   - Require numbers
   - Require symbols

### Add User to Admin Group (via AWS CLI)

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ap-southeast-1_Pwak67UsW \
  --username user@example.com \
  --group-name admin \
  --profile idp-sbx-trn-lab-01
```

### Create Admin Group (if not exists)

```bash
aws cognito-idp create-group \
  --user-pool-id ap-southeast-1_Pwak67UsW \
  --group-name admin \
  --description "Administrators with full access" \
  --profile idp-sbx-trn-lab-01
```

---

## 📦 Deployment

### Apply Terraform Changes

```bash
cd frontend-terraform/terraform
terraform apply
```

### Invalidate CloudFront Cache

```bash
# Get distribution ID from Terraform output
terraform output

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*" \
  --profile idp-sbx-trn-lab-01
```

### Manual S3 Upload (Quick Test)

```bash
cd frontend-terraform/frontend

# Upload auth files
aws s3 cp auth.js s3://YOUR-BUCKET-NAME/ --profile idp-sbx-trn-lab-01
aws s3 cp auth.css s3://YOUR-BUCKET-NAME/ --profile idp-sbx-trn-lab-01
aws s3 cp login.html s3://YOUR-BUCKET-NAME/ --profile idp-sbx-trn-lab-01
aws s3 cp signup.html s3://YOUR-BUCKET-NAME/ --profile idp-sbx-trn-lab-01
aws s3 cp verify.html s3://YOUR-BUCKET-NAME/ --profile idp-sbx-trn-lab-01

# Update main app files
aws s3 cp index.html s3://YOUR-BUCKET-NAME/ --profile idp-sbx-trn-lab-01
aws s3 cp app.js s3://YOUR-BUCKET-NAME/ --profile idp-sbx-trn-lab-01
```

---

## 🐛 Common Issues

### "USER_PASSWORD_AUTH flow not enabled"

**Fix:** Enable `ALLOW_USER_PASSWORD_AUTH` in Cognito App Client settings

### "Password must meet requirements"

**Check:** Password has 8+ chars, uppercase, lowercase, number, symbol

### Login redirects to old Hosted UI

**Fix:** Clear browser cache and CloudFront cache (see deployment section)

### "auth functions undefined" error

**Fix:** Verify `index.html` loads `auth.js` before `app.js`

### Session doesn't persist after refresh

**Fix:** Check DevTools → Application → Local Storage → Verify `cognito_tokens` exists

### Admin features not showing

**Fix:** Verify user is in `admin` group in Cognito User Pool

---

## 🎨 UI Customization

### Change Theme Colors (auth.css)

All color variables are inherited from `styles.css`:

```css
:root {
  --neon-red:      #ff1e56;
  --neon-purple:   #b400ff;
  --neon-blue:     #00d4ff;
  --neon-cyan:     #00ffcc;
  --text-primary:  #f0eaff;
  --bg-card:       #100b26;
}
```

### Modify Password Policy UI (signup.html)

The policy list is auto-validated via JavaScript:

```javascript
const policies = {
  "policy-length": pw => pw.length >= 8,
  "policy-upper":  pw => /[A-Z]/.test(pw),
  "policy-lower":  pw => /[a-z]/.test(pw),
  "policy-number": pw => /[0-9]/.test(pw),
  "policy-symbol": pw => /[^A-Za-z0-9]/.test(pw)
};
```

### Change Error Messages (auth.js)

Edit the `friendlyError()` function:

```javascript
function friendlyError(err) {
  const map = {
    NotAuthorizedException:  "Incorrect email or password.",
    UserNotFoundException:   "No account found with that email.",
    // ... add more custom messages
  };
  return map[err.code] || err.message;
}
```

---

## 📚 API Endpoints Used

| Cognito API | Purpose | Triggered By |
|-------------|---------|--------------|
| `InitiateAuth` (USER_PASSWORD_AUTH) | Sign in with email/password | `signIn()` |
| `InitiateAuth` (REFRESH_TOKEN_AUTH) | Refresh expired tokens | `refreshSession()` |
| `SignUp` | Register new user | `signUp()` |
| `ConfirmSignUp` | Verify email with code | `confirmSignUp()` |
| `ResendConfirmationCode` | Resend verification email | `resendVerificationCode()` |

All calls go to: `https://cognito-idp.ap-southeast-1.amazonaws.com/`

---

## 🔐 Security Best Practices

✅ **DO:**
- Use HTTPS only (CloudFront enforces this)
- Enable MFA for admin accounts in Cognito
- Set short token expiry times (default: 1 hour)
- Validate JWTs server-side (API Gateway does this)
- Use refresh tokens for silent session renewal

❌ **DON'T:**
- Store tokens in cookies without `httpOnly` flag (consider backend proxy for production)
- Expose sensitive user data in client-side JavaScript
- Disable password policy requirements
- Allow weak passwords (Cognito enforces this)

---

## 📞 Support Resources

- **Cognito User Pool Console:** https://console.aws.amazon.com/cognito
- **API Reference:** https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference
- **Error Codes:** https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/CommonErrors.html
- **JWT Spec:** https://jwt.io (use to decode tokens for debugging)

---

## ✅ Pre-Deployment Checklist

- [ ] `ALLOW_USER_PASSWORD_AUTH` enabled in Cognito App Client
- [ ] Password policy matches Cognito settings (8+ chars, mixed case, number, symbol)
- [ ] Email verification required in User Pool settings
- [ ] Admin group exists in Cognito User Pool
- [ ] All 5 new files added to Terraform (`auth.js`, `auth.css`, `login.html`, `signup.html`, `verify.html`)
- [ ] `index.html` loads `auth.js` before `app.js`
- [ ] CloudFront distribution configured to serve `login.html`, `signup.html`, `verify.html` as origins
- [ ] Test with a real email address (check spam folder for verification codes)

---

**Version:** 1.0  
**Last Updated:** 2026-06-03  
**Compatible With:** AWS Cognito User Pools, API Gateway HTTP API with JWT Authorizer
