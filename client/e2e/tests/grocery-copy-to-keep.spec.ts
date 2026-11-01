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
  await page.locator('[data-action="toggle-grocery"]:visible').click();

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
  await page.locator('[data-action="toggle-grocery"]:visible').click();

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
  const saves: { listData: { name: string; quantity: number }[] }[] = [];
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/grocery-list/version") &&
      request.method() === "POST"
    ) {
      saves.push(request.postDataJSON());
    }
  });
  await page.goto("/sous-chef");
  await recipesResponse;
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("selectedRecipeIds")))
    .toBe('["recipe-1"]');
  // An unchanged list is no longer re-saved; if anything is saved it must not be doubled.
  await page.waitForTimeout(1500);
  for (const saved of saves) {
    expect(
      saved.listData.find((item) => item.name === "apples")?.quantity,
    ).toBe(3);
  }
  await page.locator('[data-action="toggle-grocery"]:visible').click();

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

test("Keep copy is reachable without opening the grocery drawer", async ({
  page,
  isMobile,
}) => {
  await preparePage(page);
  await page.goto("/sous-chef");

  // Mobile exposes it in the bottom dock, desktop in the header.
  const external = page.getByRole("button", { name: "Copy to Google Keep" });
  await expect(external).toBeVisible();
  await expect(page.locator(".app-body")).not.toHaveClass(/sidebar-open/);
  if (isMobile) {
    const box = await external.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  // GroceryList loads inside the (closed) drawer; wait for its data first.
  await expect(page.getByText("Copied")).toHaveCount(0);
  await expect
    .poll(async () => {
      await external.click();
      return page.evaluate(() => localStorage.getItem("copiedGroceryText"));
    })
    .toBe("3 apples\n1 tbsp olive oil");
  await expect(page.getByText("Copied 2 items!").first()).toBeVisible();
});
