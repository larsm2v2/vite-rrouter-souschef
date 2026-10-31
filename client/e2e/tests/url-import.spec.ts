import { test, expect, Page } from "@playwright/test";

const user = {
  id: "url-import-test-user",
  email: "urlimport@example.com",
  display_name: "URL Import Test",
};

const importedRecipe = {
  name: "Original Recipe Name",
  cuisine: "Italian",
  ingredients: { default: ["1 cup flour"] },
  instructions: [{ number: 1, text: "Mix the flour." }],
  notes: [],
  images: [],
};

async function preparePage(page: Page) {
  await page.addInitScript((testUser) => {
    localStorage.setItem("user", JSON.stringify(testUser));
    localStorage.setItem("accessToken", "test-access-token");
  }, user);

  await page.route("**/auth/**", (route) => {
    if (
      route.request().resourceType() !== "xhr" &&
      route.request().resourceType() !== "fetch"
    ) {
      return route.continue();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        accessToken: "test-access-token",
      }),
    });
  });

  await page.route("**/api/**", async (route) => {
    if (
      route.request().resourceType() !== "xhr" &&
      route.request().resourceType() !== "fetch"
    ) {
      return route.continue();
    }
    const url = new URL(route.request().url());
    if (url.pathname === "/api/recipes/import-url") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ parsed: importedRecipe, imageUrls: [] }),
      });
    }
    if (
      url.pathname === "/api/recipes" &&
      route.request().method() === "POST"
    ) {
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 99 }),
      });
    }
    if (url.pathname === "/api/grocery-list/version") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ listData: [] }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
}

test("imports a recipe URL, edits the preview, and saves the result", async ({
  page,
}) => {
  await preparePage(page);
  await page.goto("/sous-chef");
  await page.getByRole("button", { name: "Create Recipe" }).click();
  await page.getByRole("button", { name: "From URL" }).click();
  await page.getByLabel("Recipe URL").fill("https://recipes.example.org/pasta");
  await page.getByRole("button", { name: "Import recipe" }).click();

  await expect(page.getByLabel("Name")).toHaveValue("Original Recipe Name");
  await page.getByLabel("Name").fill("My Pasta Recipe");
  await page
    .getByLabel("default ingredient 1", { exact: true })
    .fill("2 cups semolina");
  await page.getByLabel("Instruction 1").fill("Knead the dough.");

  let savedRecipe: Record<string, unknown> | undefined;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/recipes") && request.method() === "POST") {
      savedRecipe = request.postDataJSON() as Record<string, unknown>;
    }
  });
  await page.getByRole("button", { name: "Accept & Import" }).click();
  await expect(page.getByText("Recipe saved successfully!")).toBeVisible();
  await expect(page.locator(".ocr-modal")).toHaveCount(0);

  expect(savedRecipe).toMatchObject({
    name: "My Pasta Recipe",
    ingredients: { default: ["2 cups semolina"] },
    instructions: [{ number: 1, text: "Knead the dough." }],
  });
});
