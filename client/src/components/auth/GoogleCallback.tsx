import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { retrieveAndClearPKCEParams } from "../../utils/pkce";

/**
 * Google OAuth Callback Handler
 *
 * This component handles the OAuth callback from Google.
 * It exchanges the authorization code + PKCE verifier for tokens.
 */
export default function GoogleCallback() {
  const navigate = useNavigate();
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
        const pkceParams = retrieveAndClearPKCEParams();
        if (!pkceParams) {
          throw new Error(
            "PKCE parameters not found. Please try logging in again."
          );
        }

        // Verify state matches (CSRF protection)
        if (state !== pkceParams.state) {
          throw new Error("State mismatch - possible CSRF attack");
        }

        // Exchange code + verifier for tokens via backend
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
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

        // Store access token (you might want to use a more sophisticated state management)
        localStorage.setItem("access_token", access_token);

        // Redirect to home or dashboard
        navigate("/", { replace: true });
      } catch (err) {
        console.error("OAuth callback error:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
        setLoading(false);
      }
    };

    handleCallback();
  }, [navigate]);

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
          <button onClick={() => navigate("/login")}>Back to Login</button>
        </div>
      </div>
    );
  }

  return null;
}
