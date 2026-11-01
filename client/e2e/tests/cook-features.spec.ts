import { test, expect } from "@playwright/test";
import { prepareRecipePage } from "../helpers/recipes";
import { touchSwipe } from "../helpers/touch";

test.beforeEach(async ({ page }) => {
  await prepareRecipePage(page);
});

test.describe("serving scaler and check-off", () => {
  test("scaling updates amounts, persists across reload, and resets", async ({
    page,
  }) => {
    await page.goto("/recipes/7");
    const list = page.locator("#ingredients");
    await expect(list.getByText("1 ½ cups flour")).toBeVisible();

    await page.getByRole("button", { name: "Increase servings" }).click();
    await page.getByRole("button", { name: "Increase servings" }).click(); // 4 -> 6
    await expect(list.getByText("2 ¼ cups flour")).toBeVisible();
    await expect(list.getByText("3 leeks, sliced")).toBeVisible();
    await expect(list.getByText("salt, to taste")).toBeVisible(); // unquantified stays

    await page.reload();
    await expect(list.getByText("2 ¼ cups flour")).toBeVisible();

    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(list.getByText("1 ½ cups flour")).toBeVisible();
  });

  test("large multipliers show the non-linear scaling caveat", async ({
    page,
  }) => {
    await page.goto("/recipes/7");
    await page.getByRole("button", { name: "Scale 3×" }).click();
    await expect(page.getByText(/may not scale linearly/)).toBeVisible();
  });

  test("checking an ingredient persists and can be reset", async ({ page }) => {
    await page.goto("/recipes/7");
    await page.getByRole("checkbox", { name: "1 ½ cups flour" }).check();
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "1 ½ cups flour" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Reset checks" }).click();
    await expect(
      page.getByRole("checkbox", { name: "1 ½ cups flour" }),
    ).not.toBeChecked();
  });

  test("logging out clears saved cooking state", async ({ page }) => {
    await page.goto("/recipes/7");
    await page.getByRole("checkbox", { name: "1 ½ cups flour" }).check();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            Object.keys(localStorage).filter((k) =>
              k.startsWith("souschef:v1:"),
            ).length,
        ),
      )
      .toBeGreaterThan(0);
    await page.evaluate(() => {
      localStorage.setItem("selectedRecipeIds", '["7"]');
    });
    // Same code path as logout: the app wipes every key it owns.
    const leftovers = await page.evaluate(async () => {
      const mod = await import("/src/utils/userStorage.ts");
      mod.clearAllUserData();
      return Object.keys(localStorage).filter(
        (k) => k.startsWith("souschef:v1:") || k === "selectedRecipeIds",
      );
    });
    expect(leftovers).toEqual([]);
  });
});

test.describe("timers", () => {
  test("a detected duration is tappable, counts down, and finishes", async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto("/recipes/7");
    await page.getByRole("button", { name: "Start 10 minutes timer" }).click();
    const tray = page.getByRole("region", { name: "Timers" });
    await expect(tray.getByText("10:00")).toBeVisible();

    await page.clock.fastForward("04:00");
    await expect(tray.getByText("6:00")).toBeVisible();

    await page.clock.fastForward("06:01");
    await expect(tray.getByRole("alert")).toHaveText("Timer finished");
  });

  test("a running timer survives a reload", async ({ page }) => {
    await page.goto("/recipes/7");
    await page.getByRole("button", { name: "Start 10 minutes timer" }).click();
    await page.reload();
    const tray = page.getByRole("region", { name: "Timers" });
    await expect(tray).toBeVisible();
    await expect(tray.getByText(/^(9|10):\d\d$/)).toBeVisible();
  });

  test("pause, add a minute, and dismiss", async ({ page }) => {
    await page.goto("/recipes/7");
    await page.getByRole("button", { name: "Start 10 minutes timer" }).click();
    const tray = page.getByRole("region", { name: "Timers" });
    await tray.getByRole("button", { name: /^Pause/ }).click();
    await expect(tray.getByRole("button", { name: /^Resume/ })).toBeVisible();
    await tray.getByRole("button", { name: /^Add one minute/ }).click();
    await expect(tray.getByText(/^(10|11):\d\d$/)).toBeVisible();
    await tray.getByRole("button", { name: /^Dismiss/ }).click();
    await expect(tray).toHaveCount(0);
  });

  test("instruction markup is rendered as text, never executed", async ({
    page,
  }) => {
    await page.goto("/recipes/9");
    await expect(
      page.locator("#instructions").getByText("<img src=x", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { __xss?: number }).__xss,
      ),
    ).toBeUndefined();
    expect(await page.locator("#instructions img").count()).toBe(0);
  });
});

test.describe("cook mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      let acquired = 0;
      let released = 0;
      const listeners: Record<string, () => void> = {};
      Object.defineProperty(window, "__wake", {
        value: () => ({ acquired, released }),
      });
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: {
          request: async () => {
            acquired += 1;
            return {
              release: async () => {
                released += 1;
              },
              addEventListener: (name: string, fn: () => void) => {
                listeners[name] = fn;
              },
            };
          },
        },
      });
    });
  });

  test("start, advance, retreat, and finish", async ({ page }) => {
    await page.goto("/recipes/7");
    await page.getByRole("link", { name: "Start cooking" }).click();
    await expect(page).toHaveURL(/\/recipes\/7\/cook$/);
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(page.getByText("Chop the leeks.")).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Previous" }).click();
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Serve warm.")).toBeVisible();
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page).toHaveURL(/\/recipes\/7$/);
    await expect(
      page.getByRole("link", { name: "Start cooking" }),
    ).toBeVisible();
  });

  test("progress resumes after a reload and from the recipe page", async ({
    page,
  }) => {
    await page.goto("/recipes/7/cook");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await page.getByRole("link", { name: "Exit cooking mode" }).click();
    await expect(
      page.getByRole("link", { name: "Resume cooking" }),
    ).toBeVisible();
  });

  test("keyboard arrows move between steps", async ({ page }) => {
    await page.goto("/recipes/7/cook");
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
  });

  test("swiping advances and goes back", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Touch swipe only applies to phone layouts");
    await page.goto("/recipes/7/cook");
    const box = (await page.locator(".cook-step").boundingBox())!;
    const from = { x: box.x + box.width * 0.8, y: box.y + 40 };
    await touchSwipe(page, from, -box.width * 0.5);
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await touchSwipe(
      page,
      { x: box.x + box.width * 0.2, y: from.y },
      box.width * 0.5,
    );
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
  });

  test("controls are phone-sized and the page does not overflow", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/recipes/7/cook");
    for (const name of ["Next", "Ingredients"]) {
      const box = (await page
        .getByRole("button", { name: new RegExp(`^${name}`) })
        .boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(56);
    }
    const width = page.viewportSize()!.width;
    expect(
      await page.evaluate(
        (w) => document.documentElement.scrollWidth <= w,
        width,
      ),
    ).toBe(true);
    if (isMobile) {
      await expect(page.locator(".mobile-dock")).toHaveCount(0); // cook mode sits outside the app shell
    }
  });

  test("ingredient sheet scales and checks, and closes with Escape", async ({
    page,
  }) => {
    await page.goto("/recipes/7/cook");
    await page.getByRole("button", { name: /^Ingredients/ }).click();
    const sheet = page.getByRole("dialog", { name: "Ingredients" });
    await sheet.getByRole("button", { name: "Scale 2×" }).click();
    await expect(sheet.getByText("3 cups flour")).toBeVisible();
    await sheet.getByRole("checkbox", { name: "3 cups flour" }).check();
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Ingredients (1/3)" }),
    ).toBeVisible();
  });

  test("a timer started in a step shows in the tray", async ({ page }) => {
    await page.goto("/recipes/7/cook");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Start 10 minutes timer" }).click();
    await expect(
      page.getByRole("region", { name: "Timers" }).getByText(/^(9|10):\d\d$/),
    ).toBeVisible();
  });

  test("wake lock is requested on entry and released on exit", async ({
    page,
  }) => {
    await page.goto("/recipes/7/cook");
    await expect(
      page.getByRole("button", { name: "Screen stays on" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __wake: () => { acquired: number } }).__wake()
            .acquired,
      ),
    ).toBe(1);
    await page.getByRole("link", { name: "Exit cooking mode" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as unknown as { __wake: () => { released: number } }
            ).__wake().released,
        ),
      )
      .toBe(1);
  });

  test("the wake-lock toggle turns the lock off", async ({ page }) => {
    await page.goto("/recipes/7/cook");
    await page.getByRole("button", { name: "Screen stays on" }).click();
    await expect(
      page.getByRole("button", { name: "Screen lock off" }),
    ).toBeVisible();
  });

  test("the page copes with no wake-lock support", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: undefined,
      });
    });
    await page.goto("/recipes/7/cook");
    await expect(
      page.getByRole("button", { name: "Screen lock unavailable" }),
    ).toBeDisabled();
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
  });

  test("a recipe with no instructions explains itself", async ({ page }) => {
    await page.route(
      (url) => /\/api\/recipes\/10$/.test(url.pathname),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "10",
            name: "Empty",
            ingredients: {},
            instructions: [],
            notes: [],
            serving_info: {},
          }),
        }),
    );
    await page.goto("/recipes/10/cook");
    await expect(page.getByText("no instructions")).toBeVisible();
  });
});
