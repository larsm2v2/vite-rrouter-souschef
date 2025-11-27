import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { retrieveAndClearPKCEParams } from "../../utils/pkce";
import { useAuth } from "../../contexts/AuthContext";

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
        console.log("Full URL:", window.location.href);
        console.log("Search params:", window.location.search);

        // Only proceed if we're actually at the callback URL with a code
        if (!window.location.pathname.includes("/auth/callback")) {
          console.log("Not at callback path, skipping OAuth handling");
          return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const state = urlParams.get("state");
        const errorParam = urlParams.get("error");

        console.log("Parsed params:", { code, state, errorParam });

        // Check for OAuth errors
        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        if (!code) {
          console.error("No code found. Full search:", window.location.search);
          throw new Error("No authorization code received from Google");
        }

        // Retrieve PKCE parameters from sessionStorage
        // Diagnostic: log what's in storage first to help debugging
        console.debug("Storage before callback:", sessionStorage);
        const pkceParams = retrieveAndClearPKCEParams();
        console.debug("PKCE params retrieved:", pkceParams);
        if (!pkceParams) {
          // If PKCE params are missing, check for server-side token fragment
          const hashParams = new URLSearchParams(
            window.location.hash.replace("#", "?")
          );
          const fallbackAccess = hashParams.get("access_token");

          if (fallbackAccess) {
            // Server returned the access token in the fragment (server-side PKCE flow).
            localStorage.setItem("access_token", fallbackAccess);
            navigate("/", { replace: true });
            return;
          }

          throw new Error(
            "PKCE parameters not found. Please try logging in again (open in same tab)."
          );
        }

        // Verify state matches (CSRF protection)
        if (state !== pkceParams.state) {
          throw new Error("State mismatch - possible CSRF attack");
        }

        // Exchange code + verifier for tokens via backend
        // Match server default (client/.env uses 8000 locally) and other client code
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
        console.log(
          "Exchanging code with server at:",
          `${apiUrl}/api/oauth/google/token`
        );

        const response = await fetch(`${apiUrl}/api/oauth/google/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Include cookies
          body: JSON.stringify({
            code,
            code_verifier: pkceParams.verifier,
          }),
        });

        console.log("Token exchange response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Token exchange failed:", errorData);
          throw new Error(
            errorData.error || "Failed to exchange authorization code"
          );
        }

        const { access_token, user } = await response.json();
        console.log("Token exchange successful! User:", user);

        // Persist the access token under the expected key
        const accessToken = access_token;
        localStorage.setItem("accessToken", accessToken);

        // If server provided user data, populate AuthContext immediately
        if (user && typeof login === "function") {
          login(accessToken, user);
        } else {
          // Fallback: store just the access token, let ProtectedRoute/AuthContext handle user fetch
          console.debug(
            "No user data in token response, will fetch via /profile or /auth/check"
          );
        }

        // Navigate to profile - ProtectedRoute will verify authentication
        navigate("/profile", { replace: true });
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
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
