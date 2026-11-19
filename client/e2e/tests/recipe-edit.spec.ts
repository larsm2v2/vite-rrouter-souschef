import { test, expect } from "@playwright/test";
import { prepareRecipePage } from "../helpers/recipes";

test.describe("saved recipe editing", () => {
  test("edits and saves the recipe without leaving the detail page", async ({
    page,
  }) => {
    await prepareRecipePage(page);
    let savedBody: Record<string, unknown> | null = null;
    await page.route(
      (url) =>
        url.pathname === "/api/recipes/7" &&
        url.toString().includes("/api/recipes/7"),
      async (route) => {
        if (route.request().method() !== "PUT") return route.fallback();
        savedBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      },
    );
    await page.goto("/recipes/7");
    await page.getByRole("button", { name: "Edit Imported Soup" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit recipe" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Name", { exact: true }).fill("Updated Soup");
    await dialog.getByLabel("Cuisine").fill("Italian");
    await dialog.getByLabel("Meal type").fill("dinner");
    await dialog
      .getByLabel("Dietary restrictions (comma separated)")
      .fill("vegetarian, gluten-free");
    await dialog.getByLabel("Servings").fill("6");
    await dialog.getByLabel("default ingredient 1").fill("2 cups flour");
    await dialog.getByLabel("Instruction 1").fill("Stir gently.");
    await dialog.getByRole("button", { name: "Add note" }).click();
    await dialog.getByLabel("Note 1", { exact: true }).fill("Serve hot.");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Updated Soup" }),
    ).toBeVisible();
    await expect(page.getByText("Stir gently.")).toBeVisible();
    expect(savedBody).toMatchObject({
      name: "Updated Soup",
      cuisine: "Italian",
      mealType: "dinner",
      dietaryRestrictions: ["vegetarian", "gluten-free"],
      servingInfo: { servings: 6 },
      ingredients: {
        default: ["2 cups flour", "salt, to taste", "2 leeks, sliced"],
      },
      instructions: [
        { number: 1, text: "Stir gently." },
        { number: 2, text: "Simmer for 10 minutes." },
        { number: 3, text: "Serve warm." },
      ],
      notes: ["Serve hot."],
    });
  });

  test("cancel closes the editor without saving or changing the recipe", async ({
    page,
  }) => {
    await prepareRecipePage(page);
    let putCount = 0;
    await page.route(
      (url) => url.pathname === "/api/recipes/7",
      async (route) => {
        if (route.request().method() === "PUT") putCount += 1;
        await route.fallback();
      },
    );
    await page.goto("/recipes/7");
    await page.getByRole("button", { name: "Edit Imported Soup" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit recipe" });
    await dialog.getByLabel("Name", { exact: true }).fill("Unsaved name");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Imported Soup" }),
    ).toBeVisible();
    expect(putCount).toBe(0);
  });

  const pagePayload = {
    parsed: {
      name: "Fetched Soup",
      cuisine: "Italian",
      ingredients: { default: ["2 leeks", "1 tsp salt"] },
      instructions: [
        { number: 1, text: "Chop the leeks." },
        { number: 2, text: "Simmer." },
      ],
      notes: ["From the page"],
      servingInfo: { prepTime: "PT15M", totalTime: "PT1H30M", servings: 6 },
      images: [],
    },
    imageUrls: [],
  };

  test("updates a recipe from a web page: choose sections, undo, then save", async ({
    page,
  }) => {
    await prepareRecipePage(page);
    let fetchedUrl: string | null = null;
    await page.route(
      (url) => url.pathname === "/api/recipes/import-url",
      async (route) => {
        fetchedUrl = (route.request().postDataJSON() as { url: string }).url;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(pagePayload),
        });
      },
    );
    let savedBody: Record<string, unknown> | null = null;
    await page.route(
      (url) => url.pathname === "/api/recipes/7",
      async (route) => {
        if (route.request().method() !== "PUT") return route.fallback();
        savedBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      },
    );

    await page.goto("/recipes/7");
    await page.getByRole("button", { name: "Edit Imported Soup" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit recipe" });

    await dialog.getByRole("button", { name: "Update from a web page" }).click();
    await dialog.getByLabel("Recipe page URL").fill("https://example.com/soup");
    await dialog.getByRole("button", { name: "Fetch", exact: true }).click();

    const found = dialog.getByRole("group", { name: "Use from that page" });
    await expect(found).toBeVisible();
    expect(fetchedUrl).toBe("https://example.com/soup");
    await expect(found.getByLabel(/Ingredients/)).toBeChecked();
    await expect(found.getByLabel(/Notes/)).not.toBeChecked(); // notes are opt-in
    await expect(found.getByText("— 2 items")).toBeVisible();

    await found.getByRole("button", { name: "Apply selected" }).click();
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Fetched Soup");
    await expect(dialog.getByLabel("default ingredient 1")).toHaveValue("2 leeks");
    await expect(dialog.getByLabel("Instruction 2")).toHaveValue("Simmer.");
    await expect(found).toHaveCount(0);

    // Undo puts the whole editor back
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Imported Soup");
    await expect(dialog.getByLabel("default ingredient 1")).toHaveValue("1 1/2 cups flour");

    // Apply again, this time including notes, then save
    await dialog.getByRole("button", { name: "Fetch", exact: true }).click();
    await found.getByLabel(/Notes/).check();
    await found.getByRole("button", { name: "Apply selected" }).click();
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(dialog).toHaveCount(0);

    expect(savedBody).toMatchObject({
      name: "Fetched Soup",
      cuisine: "Italian",
      servingInfo: { prepTime: "15 min", totalTime: "1 hr 30 min", servings: 6 },
      ingredients: { default: ["2 leeks", "1 tsp salt"] },
      instructions: [
        { number: 1, text: "Chop the leeks." },
        { number: 2, text: "Simmer." },
      ],
      notes: ["From the page"],
    });
  });

  test("shows why a page could not be used and leaves the recipe untouched", async ({
    page,
  }) => {
    await prepareRecipePage(page);
    await page.route(
      (url) => url.pathname === "/api/recipes/import-url",
      (route) =>
        route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: "No structured recipe data found on that page",
          }),
        }),
    );
    await page.goto("/recipes/7");
    await page.getByRole("button", { name: "Edit Imported Soup" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit recipe" });
    await dialog.getByRole("button", { name: "Update from a web page" }).click();

    await dialog.getByLabel("Recipe page URL").fill("ftp://example.com/soup");
    await dialog.getByRole("button", { name: "Fetch", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Recipe URLs must use HTTP or HTTPS",
    );

    await dialog.getByLabel("Recipe page URL").fill("https://example.com/blog");
    await dialog.getByRole("button", { name: "Fetch", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "No structured recipe data found on that page",
    );
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Imported Soup");
  });
});
