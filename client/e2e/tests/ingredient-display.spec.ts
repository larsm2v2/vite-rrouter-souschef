import { test, expect } from "@playwright/test";
import { prepareRecipePage } from "../helpers/recipes";

test.describe("ingredient display (blocker B1)", () => {
  test.beforeEach(async ({ page }) => {
    await prepareRecipePage(page);
  });

  test("string ingredients from imports are all shown", async ({ page }) => {
    await page.goto("/recipes/7");
    const list = page.locator("#ingredients");
    await expect(list.getByText("1 ½ cups flour")).toBeVisible();
    await expect(list.getByText("salt, to taste")).toBeVisible();
    await expect(list.getByText("2 leeks, sliced")).toBeVisible();
  });

  test("structured ingredients without a quantity are not hidden", async ({
    page,
  }) => {
    await page.goto("/recipes/8");
    const list = page.locator("#ingredients");
    await expect(list.getByText("1 ½ cups flour")).toBeVisible();
    await expect(list.getByText("salt", { exact: true })).toBeVisible();
  });
});
