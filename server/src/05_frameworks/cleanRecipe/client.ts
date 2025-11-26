// Wrapper to optionally use the clean-recipe-service microservice.
// If CLEAN_RECIPE_SERVICE_URL is set (e.g. http://localhost:6000), we
// POST the recipe to the service. Otherwise we fallback to the local
// cleanRecipe implementation in `src/services/recipe.service.ts`.

import { cleanRecipe as localClean } from "../../services/recipe.service";
import {
  callWithCircuitBreaker,
  CircuitBreakerError,
} from "../myexpress/gateway/circuitBreaker";

// Helper: when running on GCP (Cloud Run), the server can obtain an ID token
// for the default service account by calling the metadata server. This token
// can be used to authenticate to another Cloud Run service that requires
// IAM-signed ID tokens.
// Simple in-memory cache for an ID token and its expiry time.
let cachedIdToken: string | null = null;
let cachedIdTokenExpiry = 0; // epoch ms

function parseJwtExpiry(token: string): number {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return 0;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf8")
    );
    if (payload && typeof payload.exp === "number") return payload.exp * 1000;
  } catch (err) {
    // ignore parse errors
  }
  return 0;
}

async function fetchIdToken(audience: string): Promise<string | null> {
  // Return cached token if present and not expired (with 60s safety margin)
  const now = Date.now();
  if (cachedIdToken && cachedIdTokenExpiry - 60000 > now) {
    return cachedIdToken;
  }

  // Metadata endpoint - try both hosts commonly available in Cloud Run
  const mdUrls = [
    `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(
      audience
    )}`,
    `http://metadata/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(
      audience
    )}`,
  ];

  for (const u of mdUrls) {
    try {
      const resp = await fetch(u, { headers: { "Metadata-Flavor": "Google" } });
      if (resp.ok) {
        const token = (await resp.text()).trim();
        if (token) {
          // Parse expiry from JWT and cache it
          const expMs = parseJwtExpiry(token);
          if (expMs > 0) {
            cachedIdToken = token;
            cachedIdTokenExpiry = expMs;
          } else {
            // Fallback: cache for 50 minutes if we can't parse expiry
            cachedIdToken = token;
            cachedIdTokenExpiry = Date.now() + 50 * 60 * 1000;
          }
          return cachedIdToken;
        }
      }
    } catch (err) {
      // ignore and try next
    }
  }

  return null;
}

export async function cleanRecipe(recipe: any): Promise<any> {
  const url = process.env.CLEAN_RECIPE_SERVICE_URL;
  if (!url) {
    // Local fallback (synchronous)
    return localClean(recipe);
  }

  try {
    const endpoint = `${url.replace(/\/$/, "")}/clean-recipe`;

    // For internal-only Cloud Run service calls, we require IAM authentication.
    // Request an ID token from the metadata server and include it as a
    // Bearer token. The audience should be the service URL by default but can
    // be overridden with CLEAN_RECIPE_SERVICE_AUDIENCE env var.
    const audience =
      process.env.CLEAN_RECIPE_SERVICE_AUDIENCE || url.replace(/\/$/, "");

    // Fetch ID token - fail loudly if not available (enforces internal-only constraint)
    const idToken = await fetchIdToken(audience);
    if (!idToken) {
      throw new Error(
        `Failed to obtain ID token for clean service authentication. ` +
          `Service URL: ${url}, Audience: ${audience}`
      );
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    };

    // Wrap the call with circuit breaker to prevent cascade failures
    const cleaned = await callWithCircuitBreaker(
      "clean-recipe-service",
      async () => {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(recipe),
        });

        if (!resp.ok) {
          const body = await resp.text();
          const errorMsg = `Clean service error: ${resp.status} ${body}`;

          // Log specific status codes to help identify auth misconfigurations
          if (resp.status === 401) {
            console.error(
              `[Clean Service] Authentication failed (401): ${body}`
            );
          } else if (resp.status === 403) {
            console.error(
              `[Clean Service] Authorization forbidden (403): ${body}`
            );
          } else if (resp.status === 404) {
            console.error(
              `[Clean Service] Endpoint not found (404): ${endpoint}`
            );
          }

          throw new Error(errorMsg);
        }

        return await resp.json();
      }
    );

    return cleaned;
  } catch (err) {
    if (err instanceof CircuitBreakerError) {
      console.warn(
        "Circuit breaker open for clean-recipe-service, falling back to local clean"
      );
    } else {
      console.warn(
        "clean-recipe-service unavailable or auth failed, falling back to local clean:",
        err && (err as Error).message
      );
    }
    return localClean(recipe);
  }
}

export default { cleanRecipe };
