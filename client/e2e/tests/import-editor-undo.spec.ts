import { test, expect, Page } from "@playwright/test";

const USER = {
  id: "editor-undo",
  email: "eu@example.com",
  display_name: "Editor Undo",
};

async function openReview(page: Page) {
  await page.addInitScript((u) => {
    localStorage.setItem("user", JSON.stringify(u));
    localStorage.setItem("selectedRecipeIds", "[]");
  }, USER);
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
      if (path.endsWith("/api/ocr/parse")) {
        return json({
          parsed: {
            name: "Soup",
            cuisine: "x",
            ingredients: { default: ["1 leek", "2 carrots", "salt"] },
            instructions: [
              { number: 1, text: "Chop." },
              { number: 2, text: "Simmer." },
              { number: 3, text: "Serve." },
            ],
            notes: [],
          },
          text: "soup",
        });
      }
      if (path.endsWith("/api/grocery-list/version")) return json(null);
      return json([]);
    },
  );
  await page.goto("/sous-chef");
  await page.getByRole("button", { name: "Create Recipe" }).click();
  await page.getByRole("button", { name: "Text Editor" }).click();
  await page.getByLabel("OCR text editor").fill("soup");
  await page.getByRole("button", { name: "Parse Text on Server" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Soup");
}

test.describe("import editor undo", () => {
  test("removing an ingredient can be undone into the same position", async ({
    page,
  }) => {
    await openReview(page);
    await page
      .getByRole("button", { name: "Remove ingredient 2 from default" })
      .click();
    await expect(page.getByLabel("default ingredient 3")).toHaveCount(0);
    await expect(
      page.getByLabel("default ingredient 2", { exact: true }),
    ).toHaveValue("salt");

    await page
      .getByRole("status")
      .filter({ hasText: "Ingredient removed" })
      .getByRole("button", { name: "Undo" })
      .click();
    await expect(
      page.getByLabel("default ingredient 2", { exact: true }),
    ).toHaveValue("2 carrots");
    await expect(
      page.getByLabel("default ingredient 3", { exact: true }),
    ).toHaveValue("salt");
  });

  test("removing a step renumbers, and undo restores the step and the numbering", async ({
    page,
  }) => {
    await openReview(page);
    await page
      .getByRole("button", { name: "Remove instruction step 2" })
      .click();
    await expect(page.getByLabel("Instruction 2")).toHaveValue("Serve.");
    await expect(page.getByLabel("Instruction 3")).toHaveCount(0);

    await page
      .getByRole("status")
      .filter({ hasText: "Step 2 removed" })
      .getByRole("button", { name: "Undo" })
      .click();
    await expect(page.getByLabel("Instruction 2")).toHaveValue("Simmer.");
    await expect(page.getByLabel("Instruction 3")).toHaveValue("Serve.");
  });

  test("edits made during the undo window are kept when the row comes back", async ({
    page,
  }) => {
    await openReview(page);
    await page
      .getByRole("button", { name: "Remove ingredient 1 from default" })
      .click();
    await page.getByLabel("Name").fill("Edited Soup");
    await page.getByLabel("Instruction 1").fill("Chop finely.");
    await page
      .getByRole("status")
      .filter({ hasText: "Ingredient removed" })
      .getByRole("button", { name: "Undo" })
      .click();

    await expect(page.getByLabel("Name")).toHaveValue("Edited Soup");
    await expect(page.getByLabel("Instruction 1")).toHaveValue("Chop finely.");
    await expect(
      page.getByLabel("default ingredient 1", { exact: true }),
    ).toHaveValue("1 leek");
  });

  test("without undoing, the removal stands", async ({ page }) => {
    await openReview(page);
    await page
      .getByRole("button", { name: "Remove ingredient 3 from default" })
      .click();
    await expect(
      page.getByLabel("default ingredient 3", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Ingredient removed" }),
    ).toBeVisible();
  });
});
