# OAuth Routes Problem & Cleanup Plan

## Problem Diagnosis

### Root Cause

**Import path error in `auth-google-pkce.routes.ts`:**

```typescript
// WRONG (lines 3-8):
import {
  initializeGoogleOAuthClient,
  getGoogleAuthUrl,
  handleGoogleCallback,
} from "../../auth/google-oauth-pkce";
```

**Actual file location:**

- File is at: `server/src/05_frameworks/auth/google-oauth-pkce.ts`
- Routes file is at: `server/src/05_frameworks/myexpress/routes/auth-google-pkce.routes.ts`

**Correct import should be:**

```typescript
import {
  initializeGoogleOAuthClient,
  getGoogleAuthUrl,
  handleGoogleCallback,
} from "../../auth/google-oauth-pkce"; // This is CORRECT!
```

Wait... the path looks correct. Let me check the actual directory structure.

### Why Routes Stack Length = 3 (Not 6)?

From `routes/index.ts`, we're mounting:

1. ✅ `authGooglePkceRoutes` on `/auth` - **CONDITIONALLY (only if valid)**
2. ✅ `authRoutes` on `/auth`
3. ✅ `recipesRoutes` on `/api`
4. ✅ `groceryRoutes` on `/api`
5. ✅ `profileRoutes` on `/`
6. ✅ `profileFeatures` on `/api`

**Logs show "Stack length: 3"** - meaning only 3 routers mounted:

- Likely: `authRoutes`, `recipesRoutes`, `groceryRoutes`
- Missing: `authGooglePkceRoutes`, `profileRoutes`, `profileFeatures`

### Hypothesis: Async Initialization Problem

Looking at `auth-google-pkce.routes.ts`:

```typescript
// Initialize Google OAuth on module load
console.log("[AUTH-GOOGLE-PKCE] Initializing OAuth client (async)");
(async () => {
  try {
    await initializeGoogleOAuthClient();
    console.log("[AUTH-GOOGLE-PKCE] OAuth client initialized successfully");
  } catch (err) {
    console.error(
      "[AUTH-GOOGLE-PKCE] CRITICAL: Failed to initialize Google OAuth:",
      err
    );
    console.error("[AUTH-GOOGLE-PKCE] Stack:", (err as Error).stack);
  }
})();
```

**Problem:** The module exports the router BEFORE the async initialization completes. If `initializeGoogleOAuthClient()` throws an error during module load, it might cause the entire module import to fail silently in some Node.js contexts.

**Evidence:**

- No `[AUTH-GOOGLE-PKCE]` logs appear in Cloud Run logs
- Module-level console.logs are being suppressed
- The router imports successfully locally but fails in production

## Solution Options

### Option 1: Remove Async Initialization from Module Load (RECOMMENDED)

**Strategy:** Initialize OAuth client on-demand (lazy initialization)

```typescript
// auth-google-pkce.routes.ts
let isInitialized = false;

async function ensureInitialized() {
  if (!isInitialized) {
    await initializeGoogleOAuthClient();
    isInitialized = true;
  }
}

router.get("/google", async (req: Request, res: Response) => {
  try {
    await ensureInitialized(); // Initialize on first request
    const authUrl = await getGoogleAuthUrl(req);
    // ... rest of handler
  } catch (error) {
    console.error("OAuth initiation error:", error);
    res.redirect(process.env.CLIENT_URL + "/login?error=oauth_init_failed");
  }
});
```

**Pros:**

- No async operations during module load
- Routes export immediately and reliably
- Errors are caught and logged clearly
- Works with Express router registration patterns

**Cons:**

- First OAuth request has slightly higher latency
- Need to add `ensureInitialized()` to both routes

### Option 2: Separate OAuth Client Module from Routes

**Strategy:** Keep `google-oauth-pkce.ts` purely functional, no side effects

```typescript
// google-oauth-pkce.ts
let googleConfig: oauth.Configuration | null = null;

export async function getOrInitializeClient() {
  if (!googleConfig) {
    // Initialize on first call
    const authServer = await oauth.discovery(...);
    googleConfig = authServer;
  }
  return googleConfig;
}

export async function getGoogleAuthUrl(req: Request): Promise<string> {
  const config = await getOrInitializeClient(); // Ensure initialized
  // ... rest of function
}
```

**Pros:**

- Clean separation of concerns
- Routes file only imports pure functions
- No module-level side effects
- Easier to test

**Cons:**

- Requires refactoring both files

### Option 3: Use Dynamic Import in Routes Index

**Strategy:** Import PKCE routes conditionally after app startup

```typescript
// routes/index.ts
const router = express.Router();

// Import synchronous routes immediately
router.use("/auth", authRoutes);
router.use("/api", recipesRoutes);
// ...

// Dynamically import async routes
(async () => {
  try {
    const { default: authGooglePkceRoutes } = await import(
      "./auth-google-pkce.routes"
    );
    router.use("/auth", authGooglePkceRoutes);
    console.log("PKCE routes mounted successfully");
  } catch (err) {
    console.error("Failed to load PKCE routes:", err);
  }
})();

export default router;
```

**Pros:**

- Isolates async loading issues
- Main routes work regardless of PKCE status

**Cons:**

- Routes might not be available immediately on startup
- Adds complexity to route registration
- Not idiomatic Express pattern

## Recommended Approach

**Combine Option 1 + Option 2:**

### Step 1: Refactor `google-oauth-pkce.ts`

```typescript
let googleConfig: oauth.Configuration | null = null;

export async function ensureGoogleOAuthInitialized() {
  if (googleConfig) {
    return googleConfig; // Already initialized
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth environment variables missing");
  }

  const issuerUrl = new URL("https://accounts.google.com");
  const authServer = await oauth.discovery(
    issuerUrl,
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  googleConfig = authServer;
  return googleConfig;
}

export async function getGoogleAuthUrl(req: Request): Promise<string> {
  const config = await ensureGoogleOAuthInitialized();
  // ... use config instead of googleConfig
}

export async function handleGoogleCallback(req: Request): Promise<any> {
  const config = await ensureGoogleOAuthInitialized();
  // ... use config instead of googleConfig
}
```

### Step 2: Simplify `auth-google-pkce.routes.ts`

```typescript
import { Router, Request, Response } from "express";
import {
  getGoogleAuthUrl,
  handleGoogleCallback,
} from "../../auth/google-oauth-pkce";
// ... other imports

const router = Router();

// No async initialization on module load!

router.get("/google", async (req: Request, res: Response) => {
  try {
    const authUrl = await getGoogleAuthUrl(req); // Handles init internally
    // ... rest of handler
  } catch (error) {
    console.error("OAuth initiation error:", error);
    res.status(500).json({ error: "OAuth initialization failed" });
  }
});

// ... other routes

export default router;
```

### Step 3: Remove Conditional Mounting in `routes/index.ts`

```typescript
// Clean, straightforward mounting
router.use("/auth", authGooglePkceRoutes);
router.use("/auth", authRoutes);
router.use("/api", recipesRoutes);
// ... etc
```

## Best Practices from node-openid-client Examples

### PKCE Flow Pattern

```typescript
// 1. Generate PKCE parameters
const codeVerifier = oauth.randomPKCECodeVerifier();
const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);

// 2. Build authorization URL
const authUrl = oauth.buildAuthorizationUrl(config, {
  redirect_uri: callbackUrl,
  scope: "openid email profile",
  code_challenge: codeChallenge,
  code_challenge_method: "S256",
  state: randomState,
});

// 3. Exchange code for tokens
const tokens = await oauth.authorizationCodeGrant(config, currentUrl, {
  pkceCodeVerifier: codeVerifier,
  expectedState: state,
});

// 4. Fetch user info
const claims = await oauth.fetchUserInfo(config, tokens.access_token, "");
```

### Session Storage Best Practices

- **Development:** In-memory Map (current approach) ✅
- **Production (single instance):** In-memory Map is acceptable
- **Production (multiple instances):** Redis/Memcached required

Our current `pkceStore` Map is fine for now but needs Redis for horizontal scaling.

### Cookie Security

Current implementation is good:

```typescript
const cookieOptions = {
  httpOnly: true, // ✅ Prevent XSS
  secure: process.env.NODE_ENV === "production", // ✅ HTTPS only in prod
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // ✅ Cross-site in prod
  maxAge: 10 * 60 * 1000, // ✅ 10 minutes TTL
  path: "/", // ✅ Root path
};
```

## Other Issues to Investigate

### Why are module-level console.logs suppressed?

Cloud Run may be stripping logs during module initialization phase. This is common in serverless/container environments where:

- Module loading happens during container build
- Only runtime logs are captured
- stdout/stderr buffer differently during startup

**Solution:** Move all diagnostic logs to runtime (inside route handlers or middleware).

### Profile routes also missing?

Logs show only 3/6 routers mounted. Need to check if `profileRoutes` and `profileFeatures` have similar async initialization issues.

## Action Items

- [ ] **IMMEDIATE:** Fix async initialization in `google-oauth-pkce.ts`
  - Remove IIFE from module load
  - Move initialization into functions
- [ ] **IMMEDIATE:** Simplify `auth-google-pkce.routes.ts`
  - Remove async IIFE
  - Remove conditional export logic
- [ ] **IMMEDIATE:** Remove conditional mounting in `routes/index.ts`
  - Trust that all imports work
  - Let errors surface clearly
- [ ] **TEST:** Verify all 6 routers mount (stack.length = 6)

- [ ] **INVESTIGATE:** Check `profileRoutes` and `profileFeatures` for similar issues

- [ ] **FUTURE:** Add Redis for PKCE session storage when scaling horizontally

- [ ] **FUTURE:** Add integration tests for OAuth flow

## References

- [node-openid-client Documentation](https://github.com/panva/node-openid-client)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
