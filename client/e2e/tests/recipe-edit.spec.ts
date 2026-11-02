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
});
