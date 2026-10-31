import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getGoogleRedirectUri,
  retrieveAndClearPKCEParams,
} from "../../utils/pkce";
import { useAuth } from "../../contexts/AuthContext";
import { setInMemoryAccessToken } from "../pages/Client";

/**
 * Google OAuth Callback Handler
 *
 * This component handles the OAuth callback from Google.
 * It exchanges the authorization code + PKCE verifier for tokens.
 */
export default function GoogleCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse URL parameters
        // console.log("Full URL:", window.location.href);
        // console.log("Search params:", window.location.search);

        // Only proceed if we're actually at the callback URL with a code
        if (!window.location.pathname.includes("/auth/callback")) {
          return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const state = urlParams.get("state");
        const errorParam = urlParams.get("error");

        // console.log("Parsed params:", { code, state, errorParam });

        // Check for OAuth errors
        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        if (!code) {
          throw new Error("No authorization code received from Google");
        }

        // Retrieve PKCE parameters from sessionStorage
        const pkceParams = retrieveAndClearPKCEParams();
        if (!pkceParams) {
          // If PKCE params are missing, check for server-side token fragment
          const hashParams = new URLSearchParams(
            window.location.hash.replace("#", "?"),
          );
          const fallbackAccess = hashParams.get("access_token");

          if (fallbackAccess) {
            // Server returned the access token in the fragment (server-side PKCE flow).
            // Keep it in memory only; there is no user object in this branch so
            // AuthContext.login() can't be called yet.
            setInMemoryAccessToken(fallbackAccess);
            navigate("/", { replace: true });
            return;
          }

          throw new Error(
            "PKCE parameters not found. Please try logging in again (open in same tab).",
          );
        }

        // Verify state matches (CSRF protection)
        if (state !== pkceParams.state) {
          throw new Error("State mismatch - possible CSRF attack");
        }

        // Exchange code + verifier for tokens via backend
        // Match server default (client/.env uses 8000 locally) and other client code
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
        const redirectUri = getGoogleRedirectUri(
          window.location.origin,
          import.meta.env.VITE_GOOGLE_PKCE_REDIRECT_URI,
        );
        // console.log(
        //   "Exchanging code with server at:",
        //   `${apiUrl}/api/oauth/google/token`
        // );

        const response = await fetch(`${apiUrl}/api/oauth/google/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Include cookies
          body: JSON.stringify({
            code,
            code_verifier: pkceParams.verifier,
            redirect_uri: redirectUri,
          }),
        });

        // console.log("Token exchange response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Token exchange failed with status:", response.status);
          throw new Error(
            errorData.error || "Failed to exchange authorization code",
          );
        }

        const { access_token, user } = await response.json();

        // Keep the access token in memory (never localStorage)
        const accessToken = access_token;
        setInMemoryAccessToken(accessToken);

        // If server provided user data, populate AuthContext immediately
        if (user && typeof login === "function") {
          login(accessToken, user);
        } else {
          // Fallback: store just the access token, let ProtectedRoute/AuthContext handle user fetch
          console.warn("OAuth response did not include user profile data");
        }

        // Navigate to profile - ProtectedRoute will verify authentication
        navigate("/profile", { replace: true });
      } catch (err) {
        console.error(
          "OAuth callback failed:",
          err instanceof Error ? err.message : "Unknown error",
        );
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
        setLoading(false);
      }
    };

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  if (loading) {
    return (
      <div className="oauth-callback-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Completing sign in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="oauth-callback-container">
        <div className="error-message">
          <h2>Sign In Failed</h2>
          <p>{error}</p>
          <p>
            If you see "PKCE parameters not found" — it means you opened the
            callback in a different tab, or the login did not complete in the
            same tab. Please click Retry to start the flow again in the same
            tab.
          </p>
          <button onClick={() => navigate("/login")} className="retry-button">
            Retry
          </button>
          <button onClick={() => navigate("/login")}>Back to Login</button>
        </div>
      </div>
    );
  }

  return null;
}
