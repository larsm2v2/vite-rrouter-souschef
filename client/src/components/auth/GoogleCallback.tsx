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
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");
        const state = urlParams.get("state");
        const errorParam = urlParams.get("error");

        // Check for OAuth errors
        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        if (!code) {
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

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || "Failed to exchange authorization code"
          );
        }

        const { access_token } = await response.json();

        // Persist the access token under the expected key
        const accessToken = access_token;
        localStorage.setItem("accessToken", accessToken);

        // Try to fetch the authenticated user from the API, then populate auth context
        try {
          const apiUrl =
            import.meta.env.VITE_API_URL || "http://localhost:8080";
          const checkResp = await fetch(`${apiUrl}/auth/check`, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });

          if (checkResp.ok) {
            const checkData = await checkResp.json();
            if (checkData && checkData.authenticated && checkData.user) {
              // Populate AuthContext and localStorage
              try {
                // Use context login if available
                if (typeof login === "function") {
                  login(accessToken, checkData.user);
                }
              } catch {
                // Fallback: store user in localStorage
                localStorage.setItem("user", JSON.stringify(checkData.user));
              }

              // Navigate to profile
              navigate("/profile", { replace: true });
              return;
            }
          }
        } catch (err) {
          console.warn("Failed to fetch user after token exchange:", err);
        }

        // Fallback: navigate to profile so app can attempt refresh/check
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
  }, [navigate, login]);

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
