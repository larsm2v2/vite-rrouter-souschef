import { test, expect, Page } from "@playwright/test";

const USER = {
  id: "undo-test",
  email: "undo@example.com",
  display_name: "Undo Test",
};

interface Saved {
  listData: {
    name: string;
    quantity: number;
    unit: string;
    checked: boolean;
    aisle?: string;
  }[];
}

async function prepare(
  page: Page,
  list: Saved["listData"],
  saves: Saved[] = [],
) {
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
      if (path.endsWith("/api/grocery-list/version")) {
        if (route.request().method() === "POST") {
          saves.push(route.request().postDataJSON() as Saved);
          return json({ ok: true });
        }
        return json({ listData: list });
      }
      return json([]);
    },
  );
}

const open = (page: Page) =>
  page.locator('[data-action="toggle-grocery"]:visible').click();

const LIST = [
  { name: "apples", quantity: 3, unit: "", checked: false },
  { name: "milk", quantity: 1, unit: "cup", checked: false },
  { name: "cumin", quantity: 1, unit: "tsp", checked: false },
  { name: "bread", quantity: 1, unit: "loaf", checked: true },
];

test.describe("grocery aisles", () => {
  test("items are grouped by aisle and checked items move to In cart", async ({
    page,
  }) => {
    await prepare(page, LIST);
    await page.goto("/sous-chef");
    await open(page);
    const sidebar = page.locator("#App-sidebar");
    await expect(
      sidebar.getByRole("region", { name: "Produce" }).getByText("3 apples"),
    ).toBeVisible();
    await expect(
      sidebar
        .getByRole("region", { name: "Dairy & eggs" })
        .getByText("1 cup milk"),
    ).toBeVisible();
    await expect(
      sidebar.getByRole("region", { name: "Spices" }).getByText("1 tsp cumin"),
    ).toBeVisible();
    await expect(
      sidebar
        .getByRole("region", { name: "In cart" })
        .getByText("1 loaf bread"),
    ).toBeVisible();

    await sidebar.getByRole("button", { name: "Mark apples done" }).click();
    await expect(
      sidebar.getByRole("region", { name: "In cart" }).getByText("3 apples"),
    ).toBeVisible();
    await expect(sidebar.getByRole("region", { name: "Produce" })).toHaveCount(
      0,
    );
  });

  test("an aisle override is saved with the list", async ({ page }) => {
    const saves: Saved[] = [];
    await prepare(page, LIST, saves);
    await page.goto("/sous-chef");
    await open(page);
    const sidebar = page.locator("#App-sidebar");
    await sidebar.getByRole("button", { name: "Edit apples" }).click();
    await sidebar.getByLabel("Aisle").selectOption("Pantry");
    await sidebar
      .getByRole("button", { name: "Go", exact: true })
      .last()
      .click();
    await expect(
      sidebar.getByRole("region", { name: "Pantry" }).getByText("3 apples"),
    ).toBeVisible();
    await expect.poll(() => saves.length).toBeGreaterThan(0);
    expect(saves.at(-1)!.listData.find((i) => i.name === "apples")?.aisle).toBe(
      "Pantry",
    );
  });

  test("adding an existing item merges instead of duplicating", async ({
    page,
  }) => {
    await prepare(page, LIST);
    await page.goto("/sous-chef");
    await open(page);
    const sidebar = page.locator("#App-sidebar");
    await sidebar.getByLabel("Quantity").fill("2");
    await sidebar.getByLabel("Unit").fill("tbsp");
    await sidebar.getByLabel("Grocery item").fill("Cumin");
    // 1 tsp cumin + 2 tbsp cumin = 7 tsp
    await sidebar
      .getByRole("button", { name: "Go", exact: true })
      .first()
      .click();
    await expect(sidebar.getByText("7 tsp cumin")).toBeVisible();
    await expect(sidebar.getByText(/cumin/i)).toHaveCount(1);
  });

  test("saving does not loop: an unchanged list is not re-posted", async ({
    page,
  }) => {
    const saves: Saved[] = [];
    await prepare(page, LIST, saves);
    await page.goto("/sous-chef");
    await page.waitForTimeout(2500);
    expect(saves.length).toBe(0);
  });
});

test.describe("undo", () => {
  test("deleting a grocery item can be undone and restores its place", async ({
    page,
  }) => {
    await prepare(page, LIST);
    await page.goto("/sous-chef");
    await open(page);
    const sidebar = page.locator("#App-sidebar");
    await sidebar.getByRole("button", { name: "Delete milk" }).click();
    await expect(sidebar.getByText("1 cup milk")).toHaveCount(0);
    const toast = page.getByRole("status").filter({ hasText: "Removed milk" });
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect(
      sidebar
        .getByRole("region", { name: "Dairy & eggs" })
        .getByText("1 cup milk"),
    ).toBeVisible();
  });

  test("the Undo action is reachable by keyboard", async ({ page }) => {
    await page.clock.install();
    await prepare(page, LIST);
    await page.goto("/sous-chef");
    await open(page);
    await page
      .locator("#App-sidebar")
      .getByRole("button", { name: "Delete milk" })
      .click();
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeVisible();
    // Real keyboard travel, not .focus(): the open drawer traps Tab, and the toast must stay reachable.
    for (
      let i = 0;
      i < 100 && !(await undo.evaluate((el) => el === document.activeElement));
      i++
    ) {
      await page.keyboard.press("Tab");
    }
    await expect(undo).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.locator("#App-sidebar").getByText("1 cup milk"),
    ).toBeVisible();
  });

  test("an undo toast stays while hovered and goes away afterwards", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "hover only applies to pointer devices");
    await page.clock.install();
    await prepare(page, LIST);
    await page.goto("/sous-chef");
    await open(page);
    await page
      .locator("#App-sidebar")
      .getByRole("button", { name: "Delete milk" })
      .click();
    const toast = page.getByRole("status").filter({ hasText: "Removed milk" });
    await toast.hover();
    await page.clock.fastForward(20_000);
    await expect(toast).toBeVisible();
    await page.mouse.move(0, 0);
    await page.clock.fastForward(20_000);
    await expect(toast).toHaveCount(0);
  });

  test("the toast stack is capped", async ({ page }) => {
    await prepare(page, LIST);
    await page.goto("/sous-chef");
    await open(page);
    const sidebar = page.locator("#App-sidebar");
    await sidebar.getByRole("button", { name: "Delete milk" }).click();
    await sidebar.getByRole("button", { name: "Delete cumin" }).click();
    await sidebar.getByRole("button", { name: "Delete apples" }).click();
    await sidebar.getByRole("button", { name: "Delete bread" }).click();
    await expect(page.locator(".toast")).toHaveCount(3);
  });
});

test.describe("import draft", () => {
  const importStubs = async (page: Page) => {
    await page.route(
      (url) => url.pathname.endsWith("/api/ocr/parse"),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            parsed: {
              name: "Draft Soup",
              cuisine: "x",
              ingredients: { default: ["1 leek"] },
              instructions: [{ number: 1, text: "Cook." }],
              notes: [],
            },
            text: "leek soup",
          }),
        }),
    );
  };

  const parseText = async (page: Page) => {
    await page.getByRole("button", { name: "Create Recipe" }).click();
    await page.getByRole("button", { name: "Text Editor" }).click();
    await page.getByLabel("OCR text editor").fill("leek soup");
    await page.getByRole("button", { name: "Parse Text on Server" }).click();
    await expect(page.getByLabel("Name")).toHaveValue("Draft Soup");
  };

  test("closing mid-review keeps a draft that can be resumed with edits intact", async ({
    page,
  }) => {
    await prepare(page, []);
    await importStubs(page);
    await page.goto("/sous-chef");
    await parseText(page);
    await page.getByLabel("Name").fill("Edited Soup");
    await page.keyboard.press("Escape");
    await expect(page.locator(".ocr-modal")).toHaveCount(0);
    await expect(page.getByText(/Draft saved/)).toBeVisible();

    await page.getByRole("button", { name: "Create Recipe" }).click();
    await expect(page.getByText("Resume draft:")).toBeVisible();
    await expect(page.getByText("Edited Soup")).toBeVisible();
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.getByLabel("Name")).toHaveValue("Edited Soup");
  });

  test("a draft survives a reload", async ({ page }) => {
    await prepare(page, []);
    await importStubs(page);
    await page.goto("/sous-chef");
    await parseText(page);
    await page.waitForTimeout(800); // allow the debounced save
    await page.reload();
    await page.getByRole("button", { name: "Create Recipe" }).click();
    await expect(page.getByText("Resume draft:")).toBeVisible();
  });

  test("discarding removes the draft", async ({ page }) => {
    await prepare(page, []);
    await importStubs(page);
    await page.goto("/sous-chef");
    await parseText(page);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Create Recipe" }).click();
    await page.getByRole("button", { name: "Discard draft" }).click();
    await expect(page.getByText("Resume draft:")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Create Recipe" }).click();
    await expect(page.getByText("Resume draft:")).toHaveCount(0);
  });

  test("the Discard action on the saved-draft toast removes it", async ({
    page,
  }) => {
    await prepare(page, []);
    await importStubs(page);
    await page.goto("/sous-chef");
    await parseText(page);
    await page.keyboard.press("Escape");
    await page
      .getByRole("status")
      .filter({ hasText: "Draft saved" })
      .getByRole("button", { name: "Discard" })
      .click();
    await page.getByRole("button", { name: "Create Recipe" }).click();
    await expect(page.getByText("Resume draft:")).toHaveCount(0);
  });

  test("closing an empty modal saves nothing and shows no toast", async ({
    page,
  }) => {
    await prepare(page, []);
    await page.goto("/sous-chef");
    await page.getByRole("button", { name: "Create Recipe" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByText(/Draft saved/)).toHaveCount(0);
  });

  test("drafts are removed on logout", async ({ page }) => {
    await prepare(page, []);
    await importStubs(page);
    await page.goto("/sous-chef");
    await parseText(page);
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(() =>
        Object.keys(localStorage).some((k) => k.includes(":import-draft:")),
      ),
    ).toBe(true);
    const left = await page.evaluate(async () => {
      const mod = await import("/src/utils/userStorage.ts");
      mod.clearAllUserData();
      return Object.keys(localStorage).filter((k) =>
        k.includes(":import-draft:"),
      );
    });
    expect(left).toEqual([]);
  });
});
