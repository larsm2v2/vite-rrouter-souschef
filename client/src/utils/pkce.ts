/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0
 *
 * This implements client-side PKCE as per RFC 7636.
 * The code_verifier is generated in the browser and NEVER sent to the server.
 * Only the code_challenge is sent to the OAuth provider.
 */

/**
 * Generate a cryptographically random PKCE code verifier
 *
 * @returns A random string suitable for use as a PKCE code verifier
 */
export function generateCodeVerifier(): string {
  // Generate 64 random characters (128 bits of entropy)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);

  // Convert to base64url format (URL-safe base64 without padding)
  return base64UrlEncode(array);
}

/**
 * Generate a PKCE code challenge from a code verifier
 *
 * @param verifier - The code verifier to hash
 * @returns A promise that resolves to the code challenge
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Convert a Uint8Array to base64url format
 *
 * @param buffer - The buffer to encode
 * @returns A base64url-encoded string
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));

  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generate a random state parameter for CSRF protection
 *
 * @returns A random state string
 */
export function generateState(): string {
  return crypto.randomUUID();
}

/**
 * Store PKCE parameters in sessionStorage
 *
 * @param verifier - The code verifier to store
 * @param state - The state parameter to store
 */
export function storePKCEParams(verifier: string, state: string): void {
  sessionStorage.setItem("pkce_verifier", verifier);
  sessionStorage.setItem("oauth_state", state);
}

/**
 * Retrieve and remove PKCE parameters from sessionStorage
 *
 * @returns The stored PKCE parameters, or null if not found
 */
export function retrieveAndClearPKCEParams(): {
  verifier: string;
  state: string;
} | null {
  const verifier = sessionStorage.getItem("pkce_verifier");
  const state = sessionStorage.getItem("oauth_state");

  // Clear immediately after retrieval (one-time use)
  sessionStorage.removeItem("pkce_verifier");
  sessionStorage.removeItem("oauth_state");

  if (!verifier || !state) {
    return null;
  }

  return { verifier, state };
}

/**
 * Build a Google OAuth authorization URL with PKCE
 *
 * @param params - OAuth parameters
 * @returns The complete authorization URL
 */
export function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  scope?: string;
}): string {
  const {
    clientId,
    redirectUri,
    codeChallenge,
    state,
    scope = "openid email profile",
  } = params;

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    prompt: "select_account", // Allow user to choose account
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;
}
