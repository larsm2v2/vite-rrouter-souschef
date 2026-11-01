/**
 * layout.spec.ts
 *
 * Responsive layout invariants for Chrome desktop and mobile.
 * These tests catch: horizontal overflow, header z-index overlap, sidebar
 * toggle mechanics, and nav link visibility.
 *
 * Run: cd client && npm run e2e
 * Targets: chromium, Mobile Chrome (Pixel 5), plus other configured projects.
 */

import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FAKE_USER = {
  id: "layout-test-user",
  email: "layouttest@example.com",
  display_name: "Layout Test",
};
const FAKE_TOKEN = "fake-layout-test-token";

/**
 * Inject fake auth into localStorage so protected routes load without a
 * real backend. The AuthContext reads localStorage on mount, which satisfies
 * ProtectedRoute's PRIORITY 1 check and prevents API auth calls.
 */
async function injectFakeAuth(page: Page) {
  await page.addInitScript(
    ({ user, token }: { user: typeof FAKE_USER; token: string }) => {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("accessToken", token);
    },
    { user: FAKE_USER, token: FAKE_TOKEN },
  );
}

/**
 * Route-stub API and auth calls so layout tests never depend on a live server.
 * All /api/* return empty arrays; /auth/* return a success payload.
 *
 * IMPORTANT: The glob patterns /api/ and /auth/ are intentionally broad
 * but we MUST only intercept actual XHR/fetch API calls — NOT Vite's static file
 * serving. Vite serves JS modules like
 * `http://localhost:5173/src/components/auth/GoogleLoginButton.tsx` whose URL
 * would otherwise match /auth/. Intercepting those with JSON crashes React.
 * The resourceType() guard ensures only network API calls are stubbed.
 */
async function stubApiCalls(page: Page) {
  await page.route("**/api/**", (route) => {
    const type = route.request().resourceType();
    if (type !== "xhr" && type !== "fetch") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    });
  });
  await page.route("**/auth/**", (route) => {
    const type = route.request().resourceType();
    if (type !== "xhr" && type !== "fetch") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, accessToken: FAKE_TOKEN }),
    });
  });
}

// The grocery toggle is an edge tab on desktop and a dock button on phones.
const GROCERY_TOGGLE = '[data-action="toggle-grocery"]:visible';

/** Returns true when the page has no horizontal scrollbar. */ async function hasNoHorizontalOverflow(
  page: Page,
): Promise<boolean> {
  const width = page.viewportSize()!.width;
  return page.evaluate((viewportWidth) => {
    return document.documentElement.scrollWidth <= viewportWidth;
  }, width);
}

// ---------------------------------------------------------------------------
// No horizontal overflow – public page (login)
// ---------------------------------------------------------------------------

test.describe("No horizontal overflow – login page", () => {
  test("login page does not overflow horizontally", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// No horizontal overflow – protected pages
// ---------------------------------------------------------------------------

test.describe("No horizontal overflow – protected pages", () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeAuth(page);
    await stubApiCalls(page);
  });

  for (const route of ["/profile", "/sous-chef", "/recipes"]) {
    test(`${route} does not overflow horizontally`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      expect(await hasNoHorizontalOverflow(page)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Header / z-index – header must not obscure main content
// ---------------------------------------------------------------------------

test.describe("Header does not overlap main content", () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeAuth(page);
    await stubApiCalls(page);
  });

  test("app-main top starts below the sticky header", async ({ page }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    const headerBottom = await page.evaluate(() => {
      const header = document.querySelector(
        ".app-header",
      ) as HTMLElement | null;
      return header ? header.getBoundingClientRect().bottom : 0;
    });

    const mainTop = await page.evaluate(() => {
      const main = document.querySelector(".app-main") as HTMLElement | null;
      return main ? main.getBoundingClientRect().top : 0;
    });

    // Main content area should start at or below the header bottom.
    // Allow a small tolerance for border/gap.
    expect(mainTop).toBeGreaterThanOrEqual(headerBottom - 2);
  });
});

// ---------------------------------------------------------------------------
// Left sidebar (Grocery List) toggle
// ---------------------------------------------------------------------------

test.describe("Left sidebar toggle", () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeAuth(page);
    await stubApiCalls(page);
  });

  test("toggle control is visible on page load", async ({ page }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator(GROCERY_TOGGLE)).toBeVisible();
  });

  test("clicking the toggle opens the sidebar", async ({ page }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    await page.locator(GROCERY_TOGGLE).click();

    await expect(page.locator(".app-body")).toHaveClass(/sidebar-open/);
    await expect(page.locator("#App-sidebar")).toBeVisible();
  });

  test("the open drawer can be closed with its in-panel Close button", async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) test.skip();

    await page.goto("/sous-chef");
    await page.locator(GROCERY_TOGGLE).click();
    await expect(page.locator(".app-body")).toHaveClass(/sidebar-open/);

    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(page.locator(".app-body")).not.toHaveClass(/sidebar-open/);
    await expect(page.locator("#App-sidebar")).toBeHidden();
  });

  test("clicking the toggle again closes the sidebar on desktop", async ({
    page,
    isMobile,
  }) => {
    if (isMobile) test.skip();

    await page.goto("/sous-chef");
    const tab = page.locator(GROCERY_TOGGLE);
    await tab.click();
    await expect(page.locator(".app-body")).toHaveClass(/sidebar-open/);
    await tab.click();
    await expect(page.locator(".app-body")).not.toHaveClass(/sidebar-open/);
  });

  test("Escape closes the sidebar", async ({ page }) => {
    await page.goto("/sous-chef");
    await page.locator(GROCERY_TOGGLE).click();
    await expect(page.locator(".app-body")).toHaveClass(/sidebar-open/);

    await page.keyboard.press("Escape");
    await expect(page.locator(".app-body")).not.toHaveClass(/sidebar-open/);
  });

  test("the backdrop is a real tap target that closes the sidebar", async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) test.skip();

    await page.goto("/sous-chef");
    await page.locator(GROCERY_TOGGLE).click();

    const backdrop = page.locator(".sidebar-backdrop");
    await expect(backdrop).toBeVisible();

    // Tap the visible strip to the right of the drawer (no JS click shortcut).
    const viewport = page.viewportSize()!;
    await page.mouse.click(viewport.width - 6, viewport.height / 2);

    await expect(page.locator(".app-body")).not.toHaveClass(/sidebar-open/);
  });

  test("drawer leaves a tappable backdrop strip and fits the viewport", async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) test.skip();

    await page.goto("/sous-chef");
    await page.locator(GROCERY_TOGGLE).click();
    await expect(page.locator(".app-body")).toHaveClass(/sidebar-open/);

    // Wait for the slide-in transition to settle before measuring.
    await expect
      .poll(async () => (await page.locator("#App-sidebar").boundingBox())?.x)
      .toBe(0);
    const box = await page.locator("#App-sidebar").boundingBox();
    const viewport = page.viewportSize()!;
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThan(viewport.width);
    expect(box!.y).toBe(0);
  });

  test("page behind the drawer does not scroll while it is open", async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) test.skip();

    await page.goto("/sous-chef");
    await page.locator(GROCERY_TOGGLE).click();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("closed drawer is not reachable by keyboard or assistive tech", async ({
    page,
  }) => {
    await page.goto("/sous-chef");
    await expect(page.locator("#App-sidebar")).toHaveAttribute("inert", "");
    await page.locator(GROCERY_TOGGLE).click();
    await expect(page.locator("#App-sidebar")).not.toHaveAttribute("inert", "");
  });
});

test.describe("Mobile dock", () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeAuth(page);
    await stubApiCalls(page);
  });

  test("dock is shown on phones and hidden on desktop", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/sous-chef");
    const dock = page.getByRole("navigation", { name: "Quick actions" });
    if (isMobile) {
      await expect(dock).toBeVisible();
      for (const button of await dock.getByRole("button").all()) {
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    } else {
      await expect(dock).toBeHidden();
    }
  });

  test("the create-recipe button does not overlap the dock", async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) test.skip();

    await page.goto("/sous-chef");
    const fab = await page
      .getByRole("button", { name: "Create Recipe" })
      .boundingBox();
    const dock = await page
      .getByRole("navigation", { name: "Quick actions" })
      .boundingBox();
    expect(fab!.y + fab!.height).toBeLessThanOrEqual(dock!.y);
  });

  test("header stays on a single row", async ({ page }) => {
    await page.goto("/sous-chef");
    const header = await page.locator(".app-header").boundingBox();
    const main = await page.locator(".app-main").boundingBox();
    expect(header!.height).toBeLessThanOrEqual(64);
    expect(main!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 2);
  });

  test("search expands in place on phones", async ({ page, isMobile }) => {
    if (!isMobile) test.skip();

    await page.goto("/sous-chef");
    await expect(page.getByRole("searchbox")).toBeHidden();
    await page.getByRole("button", { name: "Open search" }).click();
    const input = page.getByLabel("Search recipes");
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    expect(await hasNoHorizontalOverflow(page)).toBe(true);
    await page.getByRole("button", { name: "Close search" }).click();
    await expect(input).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// Navbar – nav links visible and not clipped
// ---------------------------------------------------------------------------

test.describe("Navbar links are accessible", () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeAuth(page);
    await stubApiCalls(page);
  });

  test("My Recipes link is visible in viewport", async ({ page }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    // On desktop the full label is shown; on mobile the compact 'R' token is shown.
    // We find the <a> by href regardless of label.
    const link = page.locator('nav a[href="/recipes"]');
    await expect(link).toBeVisible();
  });

  test("My SousChef link is visible in viewport", async ({ page }) => {
    await page.goto("/recipes");
    await page.waitForLoadState("domcontentloaded");

    const link = page.locator('nav a[href="/sous-chef"]');
    await expect(link).toBeVisible();
  });

  test("profile avatar link is visible in viewport", async ({ page }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    const link = page.locator('nav a[href="/profile"]');
    await expect(link).toBeVisible();
  });

  test("profile avatar has a non-zero rendered size", async ({ page }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    // The compact avatar (.nav-compact.avatar) should be at least 20px wide.
    // This catches the vw-based size bug (2.2vw ≈ 8px on 375px mobile).
    const avatar = page.locator(".nav-compact.avatar");
    await expect(avatar).toBeVisible();

    const box = await avatar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(20);
    expect(box!.height).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// Sidebar does not push content off-screen
// ---------------------------------------------------------------------------

test.describe("Open sidebar does not cause horizontal overflow", () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeAuth(page);
    await stubApiCalls(page);
  });

  test("no horizontal overflow after opening left sidebar", async ({
    page,
  }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    const tab = page.locator(GROCERY_TOGGLE);
    await tab.click();

    // Wait for sidebar transition
    await page.waitForTimeout(300);

    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});
