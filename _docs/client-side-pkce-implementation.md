<!-- docs-status -->
> **Status: reference.** Describes a feature that still exists, but was written before the current docs and may contain project-specific identifiers and outdated details. Check the code first; start from [architecture.md](architecture.md) and the [documentation index](README.md).

# Client-Side PKCE Implementation Summary

## What Was Implemented

### Client-Side Components (Vite React App)

1. **`client/src/utils/pkce.ts`** - PKCE utility functions
   - `generateCodeVerifier()` - Creates random PKCE verifier
   - `generateCodeChallenge()` - Hashes verifier with SHA-256
   - `generateState()` - CSRF protection
   - `storePKCEParams()` - Store in sessionStorage
   - `retrieveAndClearPKCEParams()` - One-time retrieval
   - `buildGoogleAuthUrl()` - Construct OAuth URL

2. **`client/src/components/auth/GoogleLoginButton.tsx`** - Login button
   - Generates PKCE parameters in browser
   - Stores verifier in sessionStorage
   - Redirects to Google OAuth

3. **`client/src/components/auth/GoogleCallback.tsx`** - Callback handler
   - Retrieves code from URL
   - Gets verifier from sessionStorage
   - POSTs to backend for token exchange
   - Stores access token and redirects

### Backend Components (Cloud Run Express API)

4. **`server/src/05_frameworks/myexpress/routes/oauth-google.routes.ts`** - Token exchange
   - **Stateless endpoint**: `/api/oauth/google/token`
   - Receives `{ code, code_verifier }` from client
   - Exchanges with Google (no server storage!)
   - Returns JWT access token
   - Sets HTTP-only refresh token cookie

5. **`server/src/05_frameworks/myexpress/routes/index.ts`** - Updated routing
   - Removed `auth-google-pkce.routes` (old server-side PKCE)
   - Added `oauth-google.routes` on `/api/oauth`

## How It Works

```
┌─────────┐                 ┌────────┐                 ┌──────────┐
│ Browser │                 │  Cloud │                 │  Google  │
│  (SPA)  │                 │   Run  │                 │   OAuth  │
└────┬────┘                 └───┬────┘                 └────┬─────┘
     │                          │                           │
     │ 1. Click "Sign in"       │                           │
     ├──────────────────────────┤                           │
     │ Generate verifier+       │                           │
     │ challenge (browser)      │                           │
     │                          │                           │
     │ 2. Redirect with challenge                           │
     ├──────────────────────────┼──────────────────────────>│
     │                          │                           │
     │ 3. User authenticates    │                           │
     │<─────────────────────────┼───────────────────────────┤
     │ Redirect with code       │                           │
     │                          │                           │
     │ 4. POST /api/oauth/google/token                      │
     │    { code, verifier }    │                           │
     ├─────────────────────────>│                           │
     │                          │ 5. Exchange code+verifier │
     │                          ├──────────────────────────>│
     │                          │                           │
     │                          │ 6. Return tokens          │
     │                          │<──────────────────────────┤
     │                          │                           │
     │                          │ 7. Find/create user in DB│
     │                          │                           │
     │ 8. Return JWT tokens     │                           │
     │<─────────────────────────┤                           │
     │                          │                           │
     │ 9. Store tokens, redirect                            │
     │ to dashboard             │                           │
     └──────────────────────────┴───────────────────────────┘
```

## Key Security Features

1. **PKCE verifier never sent to Cloud Run** - Only to Google
2. **sessionStorage** - Auto-purges on tab close
3. **State parameter** - CSRF protection
4. **HTTP-only cookies** - Refresh tokens protected from XSS
5. **Stateless backend** - No session store needed

## Configuration Needed

### Client (.env)

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_API_URL=<API_URL>
# Optional; when set, must be the same origin as the deployed client.
VITE_GOOGLE_PKCE_REDIRECT_URI=https://your-frontend-domain.com/auth/callback
```

### Server (Cloud Run environment)

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
CLIENT_URL=https://your-frontend-url.com
# Optional explicit PKCE callback. If omitted, uses CLIENT_URL + /auth/callback.
GOOGLE_PKCE_REDIRECT_URI=https://your-frontend-url.com/auth/callback
# Keep this for the legacy server-side /auth/google/callback flow.
GOOGLE_CALLBACK_URL=<API_URL>/auth/google/callback
```

### Google Cloud Console Updates

**Important:** Add the exact frontend callback URI sent by the PKCE flow to the OAuth client’s **Authorized redirect URIs**:

**PKCE frontend callback:**

```
https://your-frontend-domain.com/auth/callback
```

Add the legacy API callback too if the server-side flow is still enabled:

```
<API_URL>/auth/google/callback
```

For local development, authorize the exact origin you open in the browser, for example `http://<DB_HOST>:5173/auth/callback` or `http://127.0.0.1:5173/auth/callback`. Google treats these as different redirect URIs. Do not include a trailing slash unless it is also present in the URI sent by the app.

## Next Steps

1. **Update Google Cloud Console**
   - Add frontend callback URL to authorized redirect URIs
   - Keep client ID/secret the same

2. **Set client environment variables**
   - Create `client/.env` with VITE_GOOGLE_CLIENT_ID and VITE_API_URL

3. **Update server environment**
   - Set `CLIENT_URL` to the frontend origin, or set `GOOGLE_PKCE_REDIRECT_URI` to the exact frontend callback.
   - Keep `GOOGLE_CALLBACK_URL` pointed at the API callback for the legacy server-side flow.

4. **Add route to React Router**

   ```tsx
   <Route path="/auth/callback" element={<GoogleCallback />} />
   ```

5. **Use GoogleLoginButton component**

   ```tsx
   import GoogleLoginButton from "./components/auth/GoogleLoginButton";

   function LoginPage() {
     return <GoogleLoginButton />;
   }
   ```

6. **Deploy both client and server**

7. **Test the flow end-to-end**

## Files to Remove (After Testing)

Once the new flow works:

- ❌ `server/src/05_frameworks/auth/google-oauth-pkce.ts`
- ❌ `server/src/05_frameworks/myexpress/routes/auth-google-pkce.routes.ts`

These files implement the old server-side PKCE pattern.

## Benefits

✅ **Cloud Run Compatible** - Fully stateless, horizontal scaling works  
✅ **More Secure** - PKCE verifier never leaves browser  
✅ **No Redis Needed** - No session storage required  
✅ **Simple Deployment** - Just environment variables  
✅ **Standards Compliant** - Follows RFC 7636 correctly
