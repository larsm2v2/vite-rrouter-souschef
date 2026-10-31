import { test, expect } from "@playwright/test";

const user = {
  id: "share-test-user",
  email: "sharetest@example.com",
  display_name: "Share Test",
};

const sharedRecipe = {
  id: "23",
  name: "Lemon toast",
  unique_id: 23,
  cuisine: "Mediterranean",
  meal_type: "lunch",
  dietary_restrictions: [],
  serving_info: { prep_time: "5 min", cook_time: "2 min", servings: 1 },
  ingredients: {
    dish: [{ id: 1, name: "lemons", quantity: 2, unit: "" }],
  },
  instructions: [{ number: 1, text: "Toast the bread." }],
  notes: [],
  nutrition: {},
};

test("shared recipe link survives login and can be added", async ({ page }) => {
  await page.route("**/auth/**", (route) => {
    if (
      route.request().resourceType() !== "xhr" &&
      route.request().resourceType() !== "fetch"
    ) {
      return route.continue();
    }
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/login" && route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accessToken: "test-access-token", user }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: false }),
    });
  });
  await page.route("**/api/**", (route) => {
    if (
      route.request().resourceType() !== "xhr" &&
      route.request().resourceType() !== "fetch"
    ) {
      return route.continue();
    }

    const url = new URL(route.request().url());
    if (
      url.pathname === "/api/recipes/shared/share-token" &&
      route.request().method() === "GET"
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sharedRecipe),
      });
    }
    if (url.pathname === "/api/recipes/shared/share-token/accept") {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ recipeId: 44 }),
      });
    }
    if (url.pathname === "/api/recipes/44") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...sharedRecipe, id: "44" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });

  await page.goto("/recipes/shared/share-token");
  await expect(page).toHaveURL(/\/login$/);
  await expect
    .poll(() =>
      page.evaluate(() => sessionStorage.getItem("postLoginRedirect")),
    )
    .toBe("/recipes/shared/share-token");

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button", { name: "Login", exact: true }).last().click();
  await expect(page).toHaveURL(/\/recipes\/shared\/share-token$/);
  await expect(
    page.getByText("You're viewing a shared recipe (read-only)"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lemon Toast" }),
  ).toBeVisible();
  await expect(page.getByText("2 lemons")).toBeVisible();

  await page.getByRole("button", { name: "Add to My Recipes" }).click();
  await expect(page).toHaveURL(/\/recipes\/44$/);
  await expect(
    page.getByRole("heading", { name: "Lemon Toast" }),
  ).toBeVisible();
});

test("OAuth callback restores the protected shared-recipe destination", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("postLoginRedirect", "/recipes/shared/share-token");
  });
  await page.route(
    (url) => url.pathname.includes("/api/"),
    (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/recipes/shared/share-token")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(sharedRecipe),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
    },
  );

  const userFragment = encodeURIComponent(JSON.stringify(user));
  await page.goto(`/#access_token=test-access-token&user=${userFragment}`);
  await page.reload();
  await expect(page).toHaveURL(/\/recipes\/shared\/share-token$/);
  await expect(
    page.getByText("You're viewing a shared recipe (read-only)"),
  ).toBeVisible();
});
