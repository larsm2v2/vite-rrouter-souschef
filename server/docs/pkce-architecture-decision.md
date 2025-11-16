# PKCE Architecture Decision: Client-Side vs Server-Side

## Current Implementation Issue

Our current server-side PKCE implementation violates PKCE security principles:

```typescript
// ❌ WRONG: Server generates and stores verifier
// server/src/05_frameworks/auth/google-oauth-pkce.ts
const codeVerifier = oauth.randomPKCECodeVerifier();
pkceStore.set(sessionId, { codeVerifier, state, timestamp });
```

**Problems:**

1. **Ephemeral storage**: Cloud Run instances are stateless - in-memory Map gets lost
2. **Security violation**: PKCE verifier should NEVER leave the client browser
3. **Horizontal scaling**: Multiple Cloud Run instances don't share the Map
4. **Session coupling**: Using cookies to track server-side sessions defeats PKCE purpose

## Correct PKCE Architecture for Cloud Run

### ✅ Client-Side PKCE (Recommended)

**Flow:**

```
1. Browser → Generate verifier/challenge (client-side JS)
2. Browser → Redirect to Google with challenge
3. Google → Redirect back to frontend with code
4. Browser → POST { code, verifier } to Cloud Run /api/oauth/token
5. Cloud Run → Exchange with Google, return JWT
6. Browser → Store JWT, make authenticated requests
```

**Client-Side Code (Vite React App):**

```typescript
// client/src/components/auth/GoogleLogin.tsx

async function initiateGoogleLogin() {
  // Generate PKCE parameters IN THE BROWSER
  const verifier = crypto.randomUUID() + crypto.randomUUID();
  const encoder = new TextEncoder();
  const challenge = btoa(
    String.fromCharCode(
      ...new Uint8Array(
        await crypto.subtle.digest("SHA-256", encoder.encode(verifier))
      )
    )
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // Store verifier in sessionStorage (auto-purges on tab close)
  sessionStorage.setItem("pkce_verifier", verifier);

  // Build OAuth URL
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: crypto.randomUUID(), // CSRF protection
  });

  // Redirect to Google
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
```

**Client-Side Callback Handler:**

```typescript
// client/src/components/auth/GoogleCallback.tsx

async function handleGoogleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const verifier = sessionStorage.getItem("pkce_verifier");

  if (!code || !verifier) {
    throw new Error("Missing OAuth code or verifier");
  }

  // Send code + verifier to Cloud Run
  const response = await fetch("/api/oauth/google/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier }),
  });

  const { access_token, refresh_token } = await response.json();

  // Clear verifier
  sessionStorage.removeItem("pkce_verifier");

  // Store tokens (or let server set HTTP-only cookies)
  // ... handle tokens
}
```

**Cloud Run Backend (Stateless Token Exchange):**

```typescript
// server/src/routes/oauth.routes.ts

router.post("/api/oauth/google/token", async (req, res) => {
  const { code, code_verifier } = req.body;

  if (!code || !code_verifier) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  // Exchange with Google (NO server-side storage needed!)
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      code_verifier, // Client sends this!
      redirect_uri: process.env.GOOGLE_CALLBACK_URL!,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenResponse.json();

  // Get user info
  const userInfoResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );

  const userInfo = await userInfoResponse.json();

  // Find or create user in DB
  // ... database logic

  // Generate app JWT tokens
  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = generateRefreshToken(user.id, user.email);

  // Set HTTP-only cookie for refresh token
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // Return access token to client
  res.json({ access_token: accessToken });
});
```

### Benefits of Client-Side PKCE

1. **No server-side session storage** - Cloud Run stays stateless
2. **Secure by design** - Verifier never leaves the browser
3. **Horizontal scaling** - No shared state between instances
4. **Simple deployment** - No Redis/Memcached needed
5. **PKCE compliance** - Follows RFC 7636 correctly

### Current Server-Side Approach (What We Have)

**Problems:**

```typescript
// ❌ Issues with current implementation:
const pkceStore = new Map<string, PKCESession>(); // Lost on instance restart
router.get("/google", async (req, res) => {
  const codeVerifier = oauth.randomPKCECodeVerifier(); // Should be in browser!
  pkceStore.set(sessionId, { codeVerifier }); // Ephemeral storage
  res.cookie("pkce_session", sessionId); // Cookie to track server session
  res.redirect(authUrl); // Server initiates flow
});
```

**Why it fails:**

1. Cloud Run instances scale horizontally - Instance A generates verifier, Instance B handles callback
2. In-memory Map is wiped on container restarts (every 15-60 min)
3. PKCE verifier exposed to server breaks security model
4. Extra cookies needed for session tracking

## Migration Path

### Option 1: Full Client-Side PKCE (Recommended)

- Move PKCE generation to React client
- Delete `google-oauth-pkce.ts` entirely
- Create new `/api/oauth/google/token` endpoint for exchange only
- Remove `pkceStore` Map and session cookies

### Option 2: Server-Side with Redis (Not Recommended)

- Keep current flow
- Replace Map with Redis for shared storage
- Add Redis instance to Cloud Run (costs money, adds latency)
- Still violates PKCE security model

### Option 3: Hybrid (Quick Fix)

- Use `openid-client` without PKCE (just client_secret flow)
- Simpler but less secure than PKCE
- Acceptable for server-rendered apps with session management

## Decision

**Recommend Option 1: Full Client-Side PKCE**

Reasoning:

- We already have a Vite React SPA (client-side rendering)
- Cloud Run is stateless by design
- Client-side PKCE is more secure and scalable
- No additional infrastructure (Redis) needed
- Aligns with modern OAuth 2.0 best practices

## Implementation Checklist

- [ ] Create client-side PKCE generator in `client/src/utils/pkce.ts`
- [ ] Add Google login button component with client-side flow
- [ ] Create `/auth/callback` route in React Router
- [ ] Add `/api/oauth/google/token` endpoint in Cloud Run (stateless exchange)
- [ ] Remove server-side `google-oauth-pkce.ts` module
- [ ] Remove `auth-google-pkce.routes.ts` (redirect logic)
- [ ] Update environment variables (GOOGLE_CALLBACK_URL → client URL)
- [ ] Test full OAuth flow end-to-end

## Code Snippets for Agent Context

When working on OAuth/PKCE issues, remember:

1. **PKCE verifier must be generated client-side** (in browser JavaScript)
2. **Cloud Run instances are stateless** (no in-memory storage between requests)
3. **sessionStorage is the correct place** for PKCE verifiers (auto-purges, never sent to server)
4. **Server only exchanges code + verifier for tokens** (no state needed)
5. **HTTP-only cookies for refresh tokens** (not PKCE verifiers!)

## References

- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [Google OAuth 2.0 for Web Apps](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [Cloud Run Stateless Architecture](https://cloud.google.com/run/docs/tips/general#stateless)
