/**
 * auth.js — NexMart Custom Authentication
 * 
 * Implements Cognito User Pool authentication using the InitiateAuth,
 * SignUp, and ConfirmSignUp APIs directly — NO Cognito Hosted UI.
 * 
 * Cognito Config:
 *   Region:       ap-southeast-1
 *   User Pool ID: ap-southeast-1_Pwak67UsW
 *   App Client:   2qv50999jltmlrfm3tria2kqcf
 */

/* ─── CONFIGURATION ─────────────────────────────────────────────────────── */

const AUTH_CONFIG = {
  region:      "ap-southeast-1",
  userPoolId:  "ap-southeast-1_Pwak67UsW",
  clientId:    "2qv50999jltmlrfm3tria2kqcf",
  // Cognito Identity Service Provider endpoint (no Hosted UI involved)
  endpoint:    "https://cognito-idp.ap-southeast-1.amazonaws.com/",
  // Storage key — same key used by app.js so it can read tokens seamlessly
  storageKey:  "cognito_tokens"
};

/* ─── COGNITO API HELPER ─────────────────────────────────────────────────── */

/**
 * Low-level helper that calls a Cognito Identity Provider action.
 * All Cognito User Pool API calls are POST to the regional endpoint
 * with X-Amz-Target and Content-Type headers.
 *
 * @param {string} action  - e.g. "AWSCognitoIdentityProviderService.InitiateAuth"
 * @param {object} payload - JSON body
 * @returns {Promise<object>} parsed response (throws on error)
 */
async function cognitoRequest(action, payload) {
  const response = await fetch(AUTH_CONFIG.endpoint, {
    method:  "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": action
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    // Cognito returns __type and message on errors
    const code    = data.__type || "UnknownError";
    const message = data.message || "An unexpected error occurred.";
    throw new CognitoError(code, message);
  }

  return data;
}

/* ─── CUSTOM ERROR CLASS ─────────────────────────────────────────────────── */

class CognitoError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "CognitoError";
  }
}

/* ─── JWT UTILITIES ──────────────────────────────────────────────────────── */

/**
 * Decode a JWT payload without verifying the signature.
 * Signature verification happens on the API Gateway side.
 * @param {string} token
 * @returns {object|null}
 */
function decodeJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT structure");
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/**
 * Returns true if the JWT exp claim is in the past.
 * @param {string} token
 * @returns {boolean}
 */
function isTokenExpired(token) {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return true;
  // Add a 30-second buffer to avoid edge-case race conditions
  return Date.now() >= (payload.exp - 30) * 1000;
}

/* ─── TOKEN STORAGE ──────────────────────────────────────────────────────── */

/**
 * Persist all three tokens to localStorage.
 *
 * Cognito's InitiateAuth response uses PascalCase inside AuthenticationResult:
 *   { IdToken, AccessToken, RefreshToken, ExpiresIn, TokenType }
 *
 * We normalise to snake_case here so that getStoredTokens(), getIdToken(),
 * getCurrentUser(), and isAdminUser() all work with consistent key names.
 *
 * @param {object} result - AuthenticationResult from Cognito (PascalCase keys)
 */
function saveTokens(result) {
  // Accept both PascalCase (Cognito API) and snake_case (internal re-use)
  const idToken      = result.IdToken      || result.id_token;
  const accessToken  = result.AccessToken  || result.access_token;
  const refreshToken = result.RefreshToken || result.refresh_token || null;

  const payload   = decodeJwt(idToken);
  const expiresAt = payload?.exp ? payload.exp * 1000 : Date.now() + 3600000;

  const stored = {
    id_token:      idToken,
    access_token:  accessToken,
    refresh_token: refreshToken,
    expires_at:    expiresAt,
    token_type:    "Bearer"
  };

  localStorage.setItem(AUTH_CONFIG.storageKey, JSON.stringify(stored));
}

/**
 * Retrieve stored tokens from localStorage.
 * @returns {{id_token:string, access_token:string, refresh_token:string|null}|null}
 */
function getStoredTokens() {
  const raw = localStorage.getItem(AUTH_CONFIG.storageKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Remove all stored auth tokens and clear session. */
function clearTokens() {
  localStorage.removeItem(AUTH_CONFIG.storageKey);
}

/* ─── PUBLIC AUTH API ────────────────────────────────────────────────────── */

/**
 * Sign in a user with email + password using USER_PASSWORD_AUTH flow.
 * On success, stores tokens and returns the decoded user profile.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{email:string, name:string, sub:string, groups:string[]}>}
 */
async function signIn(email, password) {
  const data = await cognitoRequest(
    "AWSCognitoIdentityProviderService.InitiateAuth",
    {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: AUTH_CONFIG.clientId,
      AuthParameters: {
        USERNAME: email.trim().toLowerCase(),
        PASSWORD: password
      }
    }
  );

  const result = data.AuthenticationResult;
  if (!result) {
    // Cognito may return a ChallengeName (e.g. NEW_PASSWORD_REQUIRED)
    throw new CognitoError(
      data.ChallengeName || "AuthChallenge",
      `Authentication challenge required: ${data.ChallengeName}`
    );
  }

  saveTokens(result);
  return getCurrentUser();
}

/**
 * Register a new user in the Cognito User Pool.
 * Sends a verification code to the provided email automatically.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<void>}
 */
async function signUp(email, password) {
  await cognitoRequest(
    "AWSCognitoIdentityProviderService.SignUp",
    {
      ClientId: AUTH_CONFIG.clientId,
      Username: email.trim().toLowerCase(),
      Password: password,
      UserAttributes: [
        { Name: "email", Value: email.trim().toLowerCase() }
      ]
    }
  );
}

/**
 * Confirm registration using the 6-digit code sent to email.
 *
 * @param {string} email
 * @param {string} code
 * @returns {Promise<void>}
 */
async function confirmSignUp(email, code) {
  await cognitoRequest(
    "AWSCognitoIdentityProviderService.ConfirmSignUp",
    {
      ClientId:         AUTH_CONFIG.clientId,
      Username:         email.trim().toLowerCase(),
      ConfirmationCode: code.trim()
    }
  );
}

/**
 * Resend the verification code to the user's email.
 *
 * @param {string} email
 * @returns {Promise<void>}
 */
async function resendVerificationCode(email) {
  await cognitoRequest(
    "AWSCognitoIdentityProviderService.ResendConfirmationCode",
    {
      ClientId: AUTH_CONFIG.clientId,
      Username: email.trim().toLowerCase()
    }
  );
}

/**
 * Attempt to refresh the session using the stored refresh token.
 * On success, updates stored tokens and returns the user profile.
 *
 * @returns {Promise<object|null>} user object, or null if refresh failed
 */
async function refreshSession() {
  const tokens = getStoredTokens();
  if (!tokens?.refresh_token) return null;

  try {
    const data = await cognitoRequest(
      "AWSCognitoIdentityProviderService.InitiateAuth",
      {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: AUTH_CONFIG.clientId,
        AuthParameters: {
          REFRESH_TOKEN: tokens.refresh_token
        }
      }
    );

    const result = data.AuthenticationResult;
    if (!result) return null;

    // Cognito does not return a new RefreshToken on REFRESH_TOKEN_AUTH —
    // carry forward the existing one. saveTokens() handles PascalCase keys.
    const updated = {
      IdToken:      result.IdToken,
      AccessToken:  result.AccessToken,
      RefreshToken: tokens.refresh_token  // reuse stored refresh token
    };

    saveTokens(updated);
    return getCurrentUser();
  } catch {
    // Refresh token expired or revoked — force re-login
    clearTokens();
    return null;
  }
}

/* ─── SESSION HELPERS ────────────────────────────────────────────────────── */

/**
 * Returns true if the user has a valid (non-expired) id_token.
 * @returns {boolean}
 */
function isAuthenticated() {
  const tokens = getStoredTokens();
  if (!tokens?.id_token) return false;
  return !isTokenExpired(tokens.id_token);
}

/**
 * Decode the stored id_token and return the user profile object.
 * Returns null if no valid session exists.
 *
 * @returns {{email:string, name:string, sub:string, groups:string[]}|null}
 */
function getCurrentUser() {
  const tokens = getStoredTokens();
  if (!tokens?.id_token) return null;

  const payload = decodeJwt(tokens.id_token);
  if (!payload) return null;

  return {
    email:  payload.email || "User",
    name:   payload.name || payload["cognito:username"] || "User",
    sub:    payload.sub,
    groups: payload["cognito:groups"] || []
  };
}

/**
 * Return the raw id_token string (used as Bearer token for API calls).
 * @returns {string|null}
 */
function getIdToken() {
  return getStoredTokens()?.id_token || null;
}

/**
 * Returns true if the current user belongs to the "admin" Cognito group.
 * Used by app.js to gate admin-only features.
 * @returns {boolean}
 */
function isAdminUser() {
  const user = getCurrentUser();
  return !!(user?.groups?.includes("admin"));
}

/**
 * Sign the user out: clear tokens and redirect to login.html.
 * No Cognito logout endpoint is called — tokens are client-side only.
 */
function logout() {
  clearTokens();
  window.location.href = "login.html";
}

/* ─── PAGE-GUARD: call on protected pages ────────────────────────────────── */

/**
 * requireAuth() — protects index.html from unauthenticated access.
 *
 * Strategy:
 *  1. If a valid (non-expired) id_token exists in localStorage → resolve
 *     immediately with the user profile. Zero network calls, zero flicker.
 *  2. If the id_token is missing/expired but a refresh_token exists →
 *     attempt a silent Cognito token refresh. On success, resolve with the
 *     refreshed user. On failure, redirect to login.html.
 *  3. If no tokens exist at all → redirect to login.html immediately
 *     (synchronous path via window.location.replace so the browser never
 *     adds index.html to history, preventing the back-button from
 *     re-entering the protected page).
 *
 * Returns a Promise that either resolves with a user object or never
 * resolves (the page navigates away before it can settle).
 *
 * @returns {Promise<{email:string, name:string, sub:string, groups:string[]}>}
 */
async function requireAuth() {
  // Fast path — valid token already in storage
  if (isAuthenticated()) {
    return getCurrentUser();
  }

  // Slow path — try silent refresh before giving up
  const tokens = getStoredTokens();
  if (tokens?.refresh_token) {
    const user = await refreshSession();
    if (user) return user;
  }

  // No valid session — redirect without adding this page to history
  window.location.replace("login.html");
  // Suspend execution so the calling page never continues rendering
  return new Promise(() => {});
}

/* ─── FRIENDLY ERROR MESSAGES ────────────────────────────────────────────── */

/**
 * Maps Cognito __type error codes to human-friendly messages.
 * @param {CognitoError} err
 * @returns {string}
 */
function friendlyError(err) {
  const map = {
    NotAuthorizedException:          "Incorrect email or password.",
    UserNotFoundException:           "No account found with that email.",
    UsernameExistsException:         "An account with this email already exists.",
    InvalidPasswordException:        "Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol.",
    InvalidParameterException:       "Please check your input — something looks off.",
    CodeMismatchException:           "That verification code is incorrect. Please try again.",
    ExpiredCodeException:            "The verification code has expired. Request a new one.",
    LimitExceededException:          "Too many attempts. Please wait a moment and try again.",
    TooManyRequestsException:        "Too many requests. Please slow down.",
    UserNotConfirmedException:       "Account not verified. Please check your email for the code.",
    UserLambdaValidationException:   "Sign-up validation failed. Please try a different email.",
    PasswordResetRequiredException:  "A password reset is required. Please contact support."
  };

  return map[err.code] || err.message || "Something went wrong. Please try again.";
}
