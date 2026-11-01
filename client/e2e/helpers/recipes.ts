import type { Page } from "@playwright/test";

export const TEST_USER = {
  id: "cook-test",
  email: "cook@example.com",
  display_name: "Cook Test",
};

export const stringRecipe = {
  id: "7",
  name: "Imported Soup",
  unique_id: 7,
  cuisine: "French",
  meal_type: "dinner",
  dietary_restrictions: [],
  serving_info: { servings: 4 },
  ingredients: {
    default: ["1 1/2 cups flour", "salt, to taste", "2 leeks, sliced"],
  },
  instructions: [
    { number: 1, text: "Chop the leeks." },
    { number: 2, text: "Simmer for 10 minutes." },
    { number: 3, text: "Serve warm." },
  ],
  notes: [],
  nutrition: {},
};

export const structuredRecipe = {
  ...stringRecipe,
  id: "8",
  name: "Structured Soup",
  ingredients: {
    dish: [
      { id: 1, name: "flour", quantity: 1.5, unit: "cups" },
      { id: 2, name: "salt", quantity: 0, unit: "" },
    ],
  },
};

export const hostileRecipe = {
  ...stringRecipe,
  id: "9",
  name: "Hostile",
  instructions: [
    { number: 1, text: '<img src=x onerror="window.__xss=1"> bake 5 minutes' },
  ],
};

export const allRecipes: Record<string, unknown> = {
  "7": stringRecipe,
  "8": structuredRecipe,
  "9": hostileRecipe,
};

export async function prepareRecipePage(
  page: Page,
  recipes: Record<string, unknown> = allRecipes,
) {
  await page.addInitScript((u) => {
    localStorage.setItem("user", JSON.stringify(u));
  }, TEST_USER);
  await page.route(
    (url) => url.pathname.includes("/api/") || url.pathname.includes("/auth/"),
    (route) => {
      const type = route.request().resourceType();
      if (type !== "xhr" && type !== "fetch") return route.continue();
      const path = new URL(route.request().url()).pathname;
      const json = (body: unknown) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (path.includes("/auth/"))
        return json({ authenticated: true, accessToken: "t" });
      const match = /\/api\/recipes\/(\d+)$/.exec(path);
      if (match && recipes[match[1]]) return json(recipes[match[1]]);
      if (path.endsWith("/api/recipes")) return json(Object.values(recipes));
      if (path.endsWith("/api/grocery-list/version"))
        return json({ listData: [] });
      return json([]);
    },
  );
}
