// Wrapper to optionally use the clean-recipe-service microservice.
// If CLEAN_RECIPE_SERVICE_URL is set (e.g. http://localhost:6000), we
// POST the recipe to the service. Otherwise we fallback to the local
// cleanRecipe implementation in `src/services/recipe.service.ts`.

import { cleanRecipe as localClean } from "../../services/recipe.service";

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

    // If the target service requires IAM authentication (Cloud Run private),
    // request an ID token from the metadata server and include it as a
    // Bearer token. The audience should be the service URL by default but can
    // be overridden with CLEAN_RECIPE_SERVICE_AUDIENCE env var.
    const audience =
      process.env.CLEAN_RECIPE_SERVICE_AUDIENCE || url.replace(/\/$/, "");
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    try {
      const idToken = await fetchIdToken(audience);
      if (idToken) {
        headers["Authorization"] = `Bearer ${idToken}`;
      }
    } catch (err) {
      // If metadata request fails, continue without Authorization header.
      // The call will fail server-side if authentication is required.
      // eslint-disable-next-line no-console
      console.warn(
        "Failed to obtain ID token for clean service auth:",
        err && (err as Error).message
      );
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(recipe),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Clean service error: ${resp.status} ${body}`);
    }

    const cleaned = await resp.json();
    return cleaned;
  } catch (err) {
    console.warn(
      "clean-recipe-service unavailable or auth failed, falling back to local clean:",
      err && (err as Error).message
    );
    return localClean(recipe);
  }
}

export default { cleanRecipe };
