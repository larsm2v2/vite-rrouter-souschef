// Wrapper to optionally use the clean-recipe-service microservice.
// If CLEAN_RECIPE_SERVICE_URL is set (e.g. http://localhost:6000), we
// POST the recipe to the service. Otherwise we fallback to the local
// cleanRecipe implementation in `src/services/recipe.service.ts`.

import { cleanRecipe as localClean } from "../../services/recipe.service";

// Helper: when running on GCP (Cloud Run), the server can obtain an ID token
// for the default service account by calling the metadata server. This token
// can be used to authenticate to another Cloud Run service that requires
// IAM-signed ID tokens.
async function fetchIdToken(audience: string): Promise<string | null> {
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
        const token = await resp.text();
        if (token && token.length > 0) return token.trim();
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
    const audience = process.env.CLEAN_RECIPE_SERVICE_AUDIENCE || url.replace(/\/$/, "");
    let headers: Record<string, string> = { "Content-Type": "application/json" };

    try {
      const idToken = await fetchIdToken(audience);
      if (idToken) {
        headers["Authorization"] = `Bearer ${idToken}`;
      }
    } catch (err) {
      // If metadata request fails, continue without Authorization header.
      // The call will fail server-side if authentication is required.
      // eslint-disable-next-line no-console
      console.warn("Failed to obtain ID token for clean service auth:", err && (err as Error).message);
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
