import { test, expect, Page } from "@playwright/test";

const FAKE_USER = {
  id: "grocery-copy-test-user",
  email: "grocerycopy@example.com",
  display_name: "Grocery Copy Test",
};

async function preparePage(page: Page, selectedRecipeIds: string[] = []) {
  await page.addInitScript(
    ({ user, selectedRecipeIds }) => {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem(
        "selectedRecipeIds",
        JSON.stringify(selectedRecipeIds),
      );
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            localStorage.setItem("copiedGroceryText", text);
          },
        },
      });
    },
    { user: FAKE_USER, selectedRecipeIds },
  );

  await page.route("**/api/**", (route) => {
    if (
      route.request().resourceType() !== "xhr" &&
      route.request().resourceType() !== "fetch"
    ) {
      return route.continue();
    }
    if (route.request().url().endsWith("/api/grocery-list/version")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          listData: [
            { name: "apples", quantity: 3, unit: "", checked: false },
            { name: "olive oil", quantity: 1, unit: "tbsp", checked: false },
            { name: "bread", quantity: 1, unit: "loaf", checked: true },
          ],
        }),
      });
    }
    if (route.request().url().endsWith("/api/recipes")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "recipe-1",
            name: "Tomato toast",
            ingredients: {
              dish: [{ id: 1, name: "apples", quantity: 3, unit: "" }],
            },
          },
        ]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
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
      body: JSON.stringify({ authenticated: true }),
    });
  });
}

test("copies only unchecked grocery items in Keep-friendly lines", async ({
  page,
}) => {
  await preparePage(page);
  await page.goto("/sous-chef");
  await page.locator(".sidebar-toggle-tab.left-toggle").click();

  const copyButton = page.getByRole("button", { name: "Copy for Google Keep" });
  await expect(copyButton).toBeVisible();
  await copyButton.click();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("copiedGroceryText")))
    .toBe("3 apples\n1 tbsp olive oil");
  await expect(page.getByText("Copied 2 items!")).toBeVisible();
});

test("grocery completion action is keyboard accessible", async ({ page }) => {
  await preparePage(page);
  await page.goto("/sous-chef");
  await page.locator(".sidebar-toggle-tab.left-toggle").click();

  const doneButton = page.getByRole("button", { name: "Mark apples done" });
  await expect(doneButton).toBeVisible();
  await doneButton.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".grocery-list__item__text").filter({ hasText: /apples/ }),
  ).toHaveClass(/done/);
});

test("does not re-add persisted selected recipes to the grocery list on reload", async ({
  page,
}) => {
  await preparePage(page, ["recipe-1"]);
  const recipesResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/recipes"),
  );
  const saveRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/grocery-list/version") &&
      request.method() === "POST",
  );
  await page.goto("/sous-chef");
  await recipesResponse;
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("selectedRecipeIds")))
    .toBe('["recipe-1"]');
  const savedList = (await saveRequest).postDataJSON() as {
    listData: { name: string; quantity: number }[];
  };
  expect(
    savedList.listData.find((item) => item.name === "apples")?.quantity,
  ).toBe(3);
  await page.locator(".sidebar-toggle-tab.left-toggle").click();

  const copyButton = page.getByRole("button", { name: "Copy for Google Keep" });
  await expect(copyButton).toBeVisible();
  await copyButton.click();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("copiedGroceryText")))
    .toContain("3 apples");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("copiedGroceryText")))
    .not.toContain("6 apples");
});
