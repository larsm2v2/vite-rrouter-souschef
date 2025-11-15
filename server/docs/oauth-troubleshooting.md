# Google OAuth Troubleshooting - Access Blocked Issue

## Date

November 14, 2025

## Current Error

**Error Message:** "You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy for keeping apps secure."

**Error URL:**

```
https://accounts.google.com/signin/oauth/error?authError=...
```

**Decoded Error:** The app doesn't comply with Google's validation rules for secure response handling.

**Redirect URI Being Used:** `https://souschef-api-pxtqq24yta-uc.a.run.app/auth/google/callback`

---

## ✅ What We've Fixed/Verified

### 1. **Switched from passport-google-oidc to passport-google-oauth20**

- Removed `passport-google-oidc` dependency
- Removed custom `CookieStore` state management (~90 lines)
- Using standard OAuth2.0 callback signature: `(accessToken, refreshToken, profile, done)`
- **Status:** ✅ Complete

### 2. **Environment Configuration**

- **Production (.env):** `GOOGLE_CALLBACK_URL=https://souschef-api-pxtqq24yta-uc.a.run.app/auth/google/callback`
- **Local (.env.local):** `GOOGLE_CALLBACK_URL=http://localhost:8080/auth/google/callback`
- **Status:** ✅ Correct

### 3. **Google Secret Manager**

- Updated `GOOGLE_CALLBACK_URL` secret from comma-separated values to single production URL
- Before: `https://souschef-api-pxtqq24yta-uc.a.run.app/auth/google/callback,http://localhost:8080/auth/google/callback`
- After: `https://souschef-api-pxtqq24yta-uc.a.run.app/auth/google/callback`
- Cloud Run service updated to use latest secret version
- **Status:** ✅ Fixed

### 4. **Google Cloud Console OAuth Credentials**

- Verified both redirect URIs are registered:
  - ✅ `https://souschef-api-pxtqq24yta-uc.a.run.app/auth/google/callback`
  - ✅ `http://localhost:8080/auth/google/callback`
- **Status:** ✅ Verified

### 5. **Entry Point Configuration**

- Updated correct entry point: `src/06_app/main.ts` (not `src/app.ts`)
- Added dotenv loading with `.env.local` override support
- **Status:** ✅ Fixed

### 6. **Cloud Run Deployment**

- Service URL: `https://souschef-api-pxtqq24yta-uc.a.run.app`
- Environment variables loaded from Secret Manager
- Latest deployment includes all fixes
- **Status:** ✅ Deployed

---

## ❌ Current Issue: Google OAuth 2.0 Policy Violation

### Error Details

Google is rejecting the OAuth flow due to "secure response handling" policy violations.

### Possible Causes

1. **Response Type Issue**

   - We're using authorization code flow but may not be handling it correctly
   - passport-google-oauth20 should handle this automatically

2. **State Parameter**

   - Removed `state: true` from strategy config (requires sessions)
   - passport-google-oauth20 may not be generating state parameter without sessions
   - **Action Needed:** Verify if state is being sent

3. **Token Handling in URL Fragment**

   - Currently redirecting with: `${clientUrl}/auth/callback#access_token=${accessToken}`
   - Google's policy may not allow tokens in URL fragments for authorization code flow
   - **Action Needed:** Consider alternative token delivery method

4. **PKCE (Proof Key for Code Exchange)**
   - Modern OAuth 2.0 best practice, may be required by Google
   - passport-google-oauth20 doesn't support PKCE out of the box
   - **Action Needed:** Check if PKCE is required

---

## 🔍 Items To Check

### High Priority

- [ ] **Verify OAuth Flow Type**

  - Check if we're using implicit flow vs authorization code flow
  - Google may require authorization code flow with PKCE

- [ ] **Check OAuth App Configuration in Google Console**

  - Application type (Web application, SPA, etc.)
  - Is the app verified or in testing mode?
  - Are there any warnings or requirements shown?

- [ ] **Review Token Response Handling**

  - Current: Redirect with token in URL fragment
  - Alternative: Use authorization code, exchange for token server-side
  - Consider: POST message or secure cookie-only approach

- [ ] **State Parameter Generation**
  - Add logging to verify state is being generated and sent
  - Verify state is being validated on callback

### Medium Priority

- [ ] **Session vs Sessionless**

  - Current: Sessions disabled (`session: false` in passport.authenticate)
  - Consider: Enable minimal session support just for OAuth state
  - Alternative: Implement custom state store (similar to old CookieStore)

- [ ] **PKCE Implementation**

  - Research if passport-google-oauth20 supports PKCE
  - Consider alternative library if needed (e.g., `openid-client`)

- [ ] **OAuth Scopes**
  - Current: `["openid", "profile", "email"]`
  - Verify these are allowed/configured in Google Console

### Low Priority

- [ ] **Browser Cache**

  - Clear browser cookies/cache
  - Try incognito mode

- [ ] **CORS Configuration**
  - Verify CLIENT_URL is correctly set in Secret Manager
  - Check CORS headers in responses

---

## 📝 Current Configuration Summary

### Passport Strategy

```typescript
new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    scope: ["openid", "profile", "email"],
    // NO state parameter - may be the issue
  },
  callback
);
```

### Auth Routes

```typescript
// Initiate OAuth
router.get(
  "/google",
  passport.authenticate("google", {
    prompt: "select_account",
  })
);

// Callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: process.env.CLIENT_URL + "/login?error=auth_failed",
    session: false, // Sessions disabled
  }),
  async (req, res) => {
    // Redirect with token in fragment
    res.redirect(`${clientUrl}/auth/callback#access_token=${accessToken}`);
  }
);
```

---

## 🎯 Next Steps

1. **Check Google Console OAuth App Status**

   - Verify app is in correct mode (testing vs production)
   - Check for any compliance warnings

2. **Review Google OAuth 2.0 Policy**

   - Link: https://developers.google.com/identity/protocols/oauth2/policies#secure-response-handling
   - Identify specific policy violation

3. **Consider Alternative Approaches**

   - Option A: Enable sessions for OAuth state management
   - Option B: Implement custom secure state handling
   - Option C: Switch to a different OAuth library that supports PKCE

4. **Add More Logging**
   - Log the full OAuth redirect URL being generated
   - Log state parameter if present
   - Check Cloud Run logs after OAuth attempt

---

## 🔗 References

- [Google OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies)
- [Passport Google OAuth20 Documentation](https://www.passportjs.org/packages/passport-google-oauth20/)
- [OAuth 2.0 PKCE](https://oauth.net/2/pkce/)
