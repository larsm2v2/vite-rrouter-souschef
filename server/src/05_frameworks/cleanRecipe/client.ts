// Wrapper to optionally use the clean-recipe-service microservice.
// If CLEAN_RECIPE_SERVICE_URL is set (e.g. http://localhost:6000), we
// POST the recipe to the service. Otherwise we fallback to the local
// cleanRecipe implementation in `src/services/recipe.service.ts`.

import { cleanRecipe as localClean } from "../../services/recipe.service";

export async function cleanRecipe(recipe: any): Promise<any> {
  const url = process.env.CLEAN_RECIPE_SERVICE_URL;
  if (!url) {
    // Local fallback (synchronous)
    return localClean(recipe);
  }

  try {
    // Use global fetch (Node 18+). If your environment doesn't expose fetch,
    // consider installing 'node-fetch' or 'cross-fetch'.
    const resp = await fetch(`${url.replace(/\/$/, "")}/clean-recipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(recipe),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Clean service error: ${resp.status} ${body}`);
    }

    const cleaned = await resp.json();
    // Ensure the cleaned recipe is returned in expected shape. The microservice
    // may not add fields like uniqueId—leave that to the caller if needed.
    return cleaned;
  } catch (err) {
    // On network/other error, surface a helpful message but fall back to local
    // cleaning to avoid breaking the main flow.
    // eslint-disable-next-line no-console
    console.warn(
      "clean-recipe-service unavailable, falling back to local clean:",
      err && (err as Error).message
    );
    return localClean(recipe);
  }
}

export default { cleanRecipe };
