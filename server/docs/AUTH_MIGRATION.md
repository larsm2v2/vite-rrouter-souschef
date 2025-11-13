# Authentication Migration: From Session Cookies to JWT Tokens

## Executive Summary

This document outlines the migration path from cookie-based session authentication to JWT (JSON Web Token) authentication for deployment to Google Cloud Run. This migration is necessary because:

1. **Third-party cookie blocking**: Modern browsers block third-party cookies by default, breaking cross-origin session authentication
2. **Cloud Run constraints**: Cloud Run is stateless and doesn't support sticky sessions, making server-side session storage unreliable
3. **Security compliance**: Moving away from `sameSite: none` cookies improves security posture

## Current Architecture Analysis

### Session-Based Authentication Flow

The current implementation uses:

1. **Server-Side Sessions**

   - PostgreSQL session store (`connect-pg-simple`)
   - Session table: `user_sessions`
   - Session lifetime: 24 hours
   - Cookie name: `sessionId`

2. **Cookie Configuration**

   ```typescript
   cookie: {
     secure: true,                    // HTTPS only in production
     sameSite: "none",                // Allows cross-origin (blocked by browsers)
     httpOnly: true,                  // Prevents XSS attacks
     maxAge: 24 * 60 * 60 * 1000     // 24 hours
   }
   ```

3. **Authentication Methods**

   - **OAuth (Google)**: `/auth/google` → callback → session creation
   - **Password-based**: Email/password → bcrypt verification → session creation
   - Both methods use Passport.js for serialization/deserialization

4. **Client Configuration**
   - Axios client with `withCredentials: true`
   - API requests include session cookie automatically
   - Auth check on page load: `GET /auth/check`

### Problems with Current Approach

1. **Third-Party Cookie Blocking**

   - Browsers reject `sameSite: none` cookies
   - Cross-origin credentials fail even with CORS `credentials: true`
   - Users can't authenticate in modern browsers

2. **Cloud Run Incompatibility**

   - Stateless containers don't share session memory
   - Session store queries add latency
   - No session affinity/sticky sessions available
   - PostgreSQL connection pooling complexity

3. **Scalability Issues**
   - Database queries on every authenticated request
   - Session table grows indefinitely without cleanup
   - Network latency to session store

## Recommended Solution: JWT with Refresh Tokens

### Architecture Overview

```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Server    │
│  (Browser)  │                    │ (Cloud Run) │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  1. Login/OAuth                  │
       ├─────────────────────────────────>│
       │                                  │
       │  2. Access + Refresh Tokens      │
       │<─────────────────────────────────┤
       │  (Store in memory/localStorage)  │
       │                                  │
       │  3. API Request + Access Token   │
       ├─────────────────────────────────>│
       │     (Authorization: Bearer XXX)  │
       │                                  │
       │  4. Verify JWT (no DB lookup)    │
       │                                  │
       │  5. Response                     │
       │<─────────────────────────────────┤
       │                                  │
       │  6. Access Token Expired?        │
       ├─────────────────────────────────>│
       │     POST /auth/refresh           │
       │     (Refresh Token)              │
       │                                  │
       │  7. New Access Token             │
       │<─────────────────────────────────┤
```

### Key Design Decisions

1. **Token Strategy**

   - **Access Token**: Short-lived (15 minutes), sent with every request
   - **Refresh Token**: Long-lived (7 days), used only to get new access tokens
   - Both are JWTs signed with server secret

2. **Storage Strategy**

   - **Access Token**: In-memory (React state/context)
   - **Refresh Token**: `localStorage` or `sessionStorage`
   - No cookies required

3. **Token Payload**

   ```typescript
   {
     sub: "user-id",              // Subject (user ID)
     email: "user@example.com",
     display_name: "User Name",
     iat: 1234567890,             // Issued at
     exp: 1234568790,             // Expiration (15 min for access, 7 days for refresh)
     type: "access" | "refresh"   // Token type
   }
   ```

4. **Security Measures**
   - HTTPS enforcement (Cloud Run provides this)
   - JWT signature verification
   - Token expiration enforcement
   - Refresh token rotation (issue new refresh token on use)
   - Optional: Refresh token allowlist in database

## Migration Plan

### Phase 1: Infrastructure Setup

#### 1.1 Install Dependencies

```powershell
cd server
npm install jsonwebtoken @types/jsonwebtoken
```

#### 1.2 Environment Variables

Add to `.env` and Cloud Run environment:

```bash
# JWT Configuration
JWT_SECRET=<generate-strong-secret-key>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Keep existing OAuth secrets
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback
```

Generate strong secret:

```powershell
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### 1.3 Create JWT Utilities

Create `server/src/utils/jwt.ts`:

```typescript
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-me";
const ACCESS_EXPIRATION = process.env.JWT_ACCESS_EXPIRATION || "15m";
const REFRESH_EXPIRATION = process.env.JWT_REFRESH_EXPIRATION || "7d";

export interface TokenPayload {
  sub: string; // User ID
  email: string;
  display_name: string;
  type: "access" | "refresh";
}

export const generateAccessToken = (
  userId: string,
  email: string,
  displayName: string
): string => {
  return jwt.sign(
    {
      sub: userId,
      email,
      display_name: displayName,
      type: "access",
    },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRATION }
  );
};

export const generateRefreshToken = (
  userId: string,
  email: string,
  displayName: string
): string => {
  return jwt.sign(
    {
      sub: userId,
      email,
      display_name: displayName,
      type: "refresh",
    },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRATION }
  );
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
};
```

### Phase 2: Server-Side Changes

#### 2.1 Create JWT Authentication Middleware

Create `server/src/middleware/jwtAuth.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../utils/jwt";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        display_name: string;
      };
    }
  }
}

export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const payload = verifyToken(token);

  if (!payload || payload.type !== "access") {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Attach user info to request
  req.user = {
    id: payload.sub,
    email: payload.email,
    display_name: payload.display_name,
  };

  next();
};

// Optional middleware for routes that work with or without auth
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload && payload.type === "access") {
      req.user = {
        id: payload.sub,
        email: payload.email,
        display_name: payload.display_name,
      };
    }
  }

  next();
};
```

#### 2.2 Update Auth Routes

Modify `server/src/05_frameworks/myexpress/routes/auth.routes.ts`:

```typescript
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from "../../../utils/jwt";

// Update OAuth callback handler
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login?error=auth_failed",
    session: false, // IMPORTANT: Disable session
  }),
  (req: Request, res: Response) => {
    if (!req.user) {
      return res.redirect("/login?error=no_user");
    }

    const user = req.user as any;

    // Generate tokens instead of creating session
    const accessToken = generateAccessToken(
      user.id,
      user.email,
      user.display_name
    );
    const refreshToken = generateRefreshToken(
      user.id,
      user.email,
      user.display_name
    );

    // Redirect to client with tokens in URL fragment (not query params for security)
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(
      `${clientUrl}/auth/callback#access_token=${accessToken}&refresh_token=${refreshToken}`
    );
  }
);

// Update password login handler
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    // Verify password (existing logic)
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate tokens instead of creating session
    const accessToken = generateAccessToken(
      user.id,
      user.email,
      user.display_name
    );
    const refreshToken = generateRefreshToken(
      user.id,
      user.email,
      user.display_name
    );

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Update registration handler
router.post("/register", async (req: Request, res: Response) => {
  const { email, password, display_name } = req.body;

  // Validation and user creation (existing logic)
  // ...

  try {
    const user = await createUser(email, password, display_name);

    // Generate tokens for auto-login
    const accessToken = generateAccessToken(
      user.id,
      user.email,
      user.display_name
    );
    const refreshToken = generateRefreshToken(
      user.id,
      user.email,
      user.display_name
    );

    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Add token refresh endpoint
router.post("/refresh", (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token required" });
  }

  const payload = verifyToken(refreshToken);

  if (!payload || payload.type !== "refresh") {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(
    payload.sub,
    payload.email,
    payload.display_name
  );
  const newRefreshToken = generateRefreshToken(
    payload.sub,
    payload.email,
    payload.display_name
  );

  res.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

// Update auth check endpoint
router.get("/check", authenticateJWT, (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    user: req.user,
  });
});

// Logout is client-side only (delete tokens from storage)
router.post("/logout", (req: Request, res: Response) => {
  // Optional: Invalidate refresh token in database if implementing allowlist
  res.json({ message: "Logged out successfully" });
});
```

#### 2.3 Update Protected Routes

Replace session-based middleware with JWT middleware:

```typescript
// OLD (session-based)
import { isAuthenticated } from "./middleware/auth";
router.get("/api/recipes", isAuthenticated, getRecipes);

// NEW (JWT-based)
import { authenticateJWT } from "./middleware/jwtAuth";
router.get("/api/recipes", authenticateJWT, getRecipes);
```

Update all protected routes in:

- `server/src/routes/*.ts`
- `server/src/05_frameworks/myexpress/routes/*.ts`

#### 2.4 Update CORS Configuration

Modify `server/src/app.ts`:

```typescript
// Remove credentials: true (no longer needed for cookies)
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.CLIENT_URL,
        "http://localhost:5173",
        "http://localhost:5174",
      ].filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: false, // Changed from true
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"], // Added Authorization
    exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
  })
);
```

#### 2.5 Remove Session Middleware

In `server/src/app.ts`, comment out or remove:

```typescript
// REMOVE OR COMMENT OUT
// import session from 'express-session';
// import { sessionConfig } from './05_frameworks/auth/sessions';
// app.use(session(sessionConfig));
```

You can keep the session code in the repository for reference but don't initialize it.

### Phase 3: Client-Side Changes

#### 3.1 Create Auth Context

Create `client/src/contexts/AuthContext.tsx`:

```typescript
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import apiClient from "../components/pages/Client";

interface User {
  id: string;
  email: string;
  display_name: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (accessToken: string, refreshToken: string, user: User) => void;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Load tokens and user from localStorage on mount
  useEffect(() => {
    const storedRefreshToken = localStorage.getItem("refreshToken");
    const storedUser = localStorage.getItem("user");

    if (storedRefreshToken && storedUser) {
      setUser(JSON.parse(storedUser));
      // Try to refresh access token
      refreshAccessToken();
    }
  }, []);

  const login = (
    newAccessToken: string,
    refreshToken: string,
    userData: User
  ) => {
    setAccessToken(newAccessToken);
    setUser(userData);

    // Store refresh token and user data
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");

    // Optional: Call server logout endpoint
    apiClient.post("/auth/logout").catch(console.error);
  };

  const refreshAccessToken = async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
      return false;
    }

    try {
      const response = await apiClient.post("/auth/refresh", { refreshToken });
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
        response.data;

      setAccessToken(newAccessToken);
      localStorage.setItem("refreshToken", newRefreshToken);

      return true;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      logout();
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        refreshAccessToken,
        isAuthenticated: !!user && !!accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
```

#### 3.2 Update Axios Client

Modify `client/src/components/pages/Client.tsx`:

```typescript
import axios, { AxiosResponse, AxiosInstance, AxiosError } from "axios";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: false, // Changed from true
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Request interceptor to add JWT token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage or auth context
    const token = localStorage.getItem("accessToken");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (import.meta.env.DEV) {
      console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

apiClient.interceptors.response.use(
  <T>(response: AxiosResponse<T>): AxiosResponse<T> => {
    if (import.meta.env.DEV) {
      console.log(`Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // Handle 401 errors (expired token)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Wait for token refresh
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) {
        // No refresh token, redirect to login
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });
        const { accessToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem("accessToken", accessToken);
        localStorage.setItem("refreshToken", newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

#### 3.3 Update Login Component

Modify `client/src/components/pages/Login.tsx`:

```typescript
import { useAuth } from "../../contexts/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Handle OAuth callback (extract tokens from URL fragment)
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      // Decode JWT to get user info (or fetch from /auth/check)
      const payload = JSON.parse(atob(accessToken.split(".")[1]));

      login(accessToken, refreshToken, {
        id: payload.sub,
        email: payload.email,
        display_name: payload.display_name,
      });

      // Store access token for immediate use
      localStorage.setItem("accessToken", accessToken);

      // Clear hash and redirect
      window.location.hash = "";
      navigate("/profile");
    }
  }, [login, navigate]);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    try {
      const response = await apiClient.post("/auth/login", {
        email,
        password,
      });

      const { accessToken, refreshToken, user } = response.data;

      login(accessToken, refreshToken, user);
      localStorage.setItem("accessToken", accessToken);

      navigate("/profile");
    } catch (error: any) {
      console.error("Login failed:", error);
      setFormError(
        error.response?.data?.message ||
          "Login failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // ... validation ...

    try {
      const response = await apiClient.post("/auth/register", {
        email,
        password,
        display_name: email.split("@")[0],
      });

      const { accessToken, refreshToken, user } = response.data;

      login(accessToken, refreshToken, user);
      localStorage.setItem("accessToken", accessToken);

      navigate("/profile");
    } catch (error: any) {
      console.error("Registration failed:", error);
      setFormError(
        error.response?.data?.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Rest of component...
};
```

#### 3.4 Wrap App with AuthProvider

Modify `client/src/main.tsx`:

```typescript
import { AuthProvider } from "./contexts/AuthContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```

#### 3.5 Update Other Components

Replace all `withCredentials: true` with token-based auth:

```typescript
// BEFORE
const response = await fetch("/api/recipes", {
  credentials: "include",
});

// AFTER
const token = localStorage.getItem("accessToken");
const response = await fetch("/api/recipes", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// OR (better, using apiClient which adds token automatically)
const response = await apiClient.get("/api/clean-recipes");
```

### Phase 4: Testing

#### 4.1 Local Testing Checklist

- [ ] OAuth login flow works and redirects with tokens
- [ ] Password login returns tokens
- [ ] Registration returns tokens and auto-logs in
- [ ] API requests include `Authorization: Bearer <token>` header
- [ ] Token refresh works when access token expires
- [ ] Logout clears tokens from localStorage
- [ ] Protected routes reject requests without valid token
- [ ] 401 errors trigger token refresh automatically

#### 4.2 Test Commands

```powershell
# Start server
cd server
npm run dev

# Start client
cd client
npm run dev

# Test OAuth flow
# 1. Click "Continue with Google"
# 2. Complete OAuth
# 3. Should redirect to /auth/callback with tokens in URL hash
# 4. Should auto-login and navigate to /profile

# Test password login
# 1. Enter email/password
# 2. Click Login
# 3. Check browser DevTools → Application → Local Storage
# 4. Should see accessToken, refreshToken, user

# Test token refresh
# 1. Login
# 2. Wait 15+ minutes (or modify JWT_ACCESS_EXPIRATION to 1m for testing)
# 3. Make API request
# 4. Should auto-refresh and succeed

# Test logout
# 1. Login
# 2. Click logout
# 3. Check localStorage - should be empty
# 4. Try accessing protected route - should redirect to login
```

### Phase 5: Cloud Run Deployment

#### 5.1 Update Environment Variables

In Google Cloud Console → Cloud Run → Edit & Deploy New Revision:

```powershell
JWT_SECRET=<strong-secret-from-step-1.2>
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback
CLIENT_URL=https://your-client-domain.com
NODE_ENV=production
```

#### 5.2 Update Dockerfile (if needed)

Ensure JWT utilities are included:

```dockerfile
COPY server/src ./src
COPY server/package*.json ./
RUN npm ci --only=production
```

#### 5.3 Deploy

```powershell
# Build and deploy server
cd server
gcloud run deploy souschef-api `
  --source . `
  --region us-central1 `
  --allow-unauthenticated `
  --set-env-vars "NODE_ENV=production,JWT_SECRET=<secret>"

# Build and deploy client
cd client
npm run build
# Deploy to Cloud Run, Firebase Hosting, or static host
```

#### 5.4 Update OAuth Redirect URIs

In Google Cloud Console → APIs & Services → Credentials:

Add authorized redirect URI:

```
https://your-domain.com/auth/google/callback
```

### Phase 6: Migration Strategy

#### 6.1 Gradual Rollout (Optional)

To minimize risk, support both session and JWT auth temporarily:

1. Keep session middleware active
2. Add JWT middleware as alternative
3. Check for JWT first, fall back to session
4. Monitor usage metrics
5. Remove session support after migration complete

#### 6.2 Database Cleanup

After migration is stable:

```sql
-- Drop session table (optional, keep for rollback period)
-- DROP TABLE user_sessions;

-- Create refresh token table (if implementing allowlist)
CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_token_hash (token_hash)
);
```

## Security Considerations

### Token Storage

1. **Access Token**: Store in memory only (React state/context)

   - Pros: XSS protection (not in localStorage)
   - Cons: Lost on page refresh (acceptable for short-lived tokens)

2. **Refresh Token**: Store in `localStorage`
   - Pros: Survives page refresh, enables seamless re-authentication
   - Cons: Vulnerable to XSS attacks
   - Mitigation: Implement refresh token rotation, short expiration (7 days)

### Best Practices

1. **Always use HTTPS** - Cloud Run provides this by default
2. **Rotate refresh tokens** - Issue new refresh token on every use
3. **Implement token allowlist** - Store valid refresh tokens in database
4. **Monitor for anomalies** - Track token usage patterns
5. **Rate limit auth endpoints** - Prevent brute force attacks
6. **Validate token claims** - Check `type`, `exp`, `sub` fields
7. **Use strong secrets** - 64+ character random strings

### XSS Protection

Since tokens are in localStorage (vulnerable to XSS):

1. **Sanitize all user input** - Prevent script injection
2. **Use Content Security Policy (CSP)**:
   ```typescript
   app.use(
     helmet({
       contentSecurityPolicy: {
         directives: {
           defaultSrc: ["'self'"],
           scriptSrc: ["'self'"],
           styleSrc: ["'self'", "'unsafe-inline'"],
         },
       },
     })
   );
   ```
3. **Keep dependencies updated** - Patch known vulnerabilities
4. **Regular security audits** - Use tools like `npm audit`

## Rollback Plan

If migration fails:

1. **Revert server changes**:

   ```powershell
   git revert <migration-commit-hash>
   ```

2. **Re-enable session middleware**:

   ```typescript
   app.use(session(sessionConfig));
   app.use(passport.initialize());
   app.use(passport.session());
   ```

3. **Restore CORS credentials**:

   ```typescript
   credentials: true;
   ```

4. **Redeploy**:

   ```powershell
   gcloud run deploy souschef-api --source .
   ```

5. **Client rollback**:
   ```powershell
   cd client
   git revert <migration-commit-hash>
   npm run build
   # Redeploy client
   ```

## Performance Considerations

### JWT Benefits

1. **No database lookups** on every request (unlike sessions)
2. **Stateless authentication** - scales horizontally on Cloud Run
3. **Reduced latency** - no PostgreSQL query for session data
4. **Lower database load** - sessions table no longer grows

### Potential Issues

1. **Token size** - JWTs are larger than session IDs (~200 bytes vs 32 bytes)
2. **Token invalidation** - Can't revoke JWTs immediately (must wait for expiration)
3. **Client-side logic** - More complex token management in browser

### Optimizations

1. **Keep JWT payload small** - Only include essential claims
2. **Implement token allowlist** - For critical revocation needs
3. **Cache user data** - Don't decode JWT on every render
4. **Use efficient signing** - HS256 (HMAC) is faster than RS256 (RSA)

## Monitoring and Logging

### Key Metrics to Track

1. **Token generation rate** - Spike indicates issues
2. **Token refresh rate** - Should be predictable (every 15 min per user)
3. **401 error rate** - High rate indicates auth problems
4. **Login success/failure rate** - Monitor for attacks

### Logging Strategy

```typescript
// Log auth events
console.log("[AUTH]", {
  event: "login_success",
  user_id: user.id,
  method: "google_oauth",
  timestamp: new Date().toISOString(),
});

console.log("[AUTH]", {
  event: "token_refresh",
  user_id: payload.sub,
  timestamp: new Date().toISOString(),
});

console.log("[AUTH]", {
  event: "auth_failure",
  reason: "invalid_token",
  ip: req.ip,
  timestamp: new Date().toISOString(),
});
```

### Cloud Run Monitoring

1. **Set up alerts** for high 401 error rates
2. **Monitor response times** - Should improve without session DB queries
3. **Track memory usage** - JWT operations are CPU-bound, not memory-bound
4. **Review logs** in Cloud Logging for auth patterns

## Next Steps

1. **Review this document** with your team
2. **Set up development environment** with JWT secrets
3. **Implement Phase 1** (infrastructure setup)
4. **Test locally** with both OAuth and password auth
5. **Implement Phases 2-3** (server and client changes)
6. **Conduct thorough testing** (Phase 4)
7. **Deploy to staging** environment
8. **Monitor for issues** before production rollout
9. **Deploy to production** (Phase 5)
10. **Clean up old code** after stable period (Phase 6)

## Resources

- [JWT.io](https://jwt.io/) - JWT debugger and documentation
- [RFC 7519](https://tools.ietf.org/html/rfc7519) - JWT specification
- [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Cloud Run Authentication](https://cloud.google.com/run/docs/authenticating/overview)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)

## Support

For questions or issues during migration:

1. Check this document for guidance
2. Review JWT payload in [jwt.io](https://jwt.io) debugger
3. Check server logs for auth errors
4. Verify environment variables are set correctly
5. Test with `curl` commands to isolate client vs server issues

Example PowerShell test with `curl.exe` or `Invoke-RestMethod`:

```powershell
# Test login (using Invoke-RestMethod)
$loginResponse = Invoke-RestMethod -Uri "http://localhost:8000/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"test@example.com","password":"password123"}'

# Or using curl.exe
curl.exe -X POST http://localhost:8000/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"test@example.com\",\"password\":\"password123\"}'

# Test protected route with token (using Invoke-RestMethod)
$token = "<your-access-token>"
Invoke-RestMethod -Uri "http://localhost:8000/api/recipes" `
  -Method Get `
  -Headers @{ Authorization = "Bearer $token" }

# Or using curl.exe
curl.exe -X GET http://localhost:8000/api/recipes `
  -H "Authorization: Bearer <your-access-token>"

# Test token refresh (using Invoke-RestMethod)
$refreshResponse = Invoke-RestMethod -Uri "http://localhost:8000/auth/refresh" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"refreshToken":"<your-refresh-token>"}'

# Or using curl.exe
curl.exe -X POST http://localhost:8000/auth/refresh `
  -H "Content-Type: application/json" `
  -d '{\"refreshToken\":\"<your-refresh-token>\"}'
```
