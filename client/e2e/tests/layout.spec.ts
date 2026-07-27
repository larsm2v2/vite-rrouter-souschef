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

/** Returns true when the page has no horizontal scrollbar. */
async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
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

  test("toggle tab is visible on page load", async ({ page }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    const tab = page.locator(".sidebar-toggle-tab.left-toggle");
    await expect(tab).toBeVisible();
  });

  test("clicking toggle tab opens the sidebar", async ({ page }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    const tab = page.locator(".sidebar-toggle-tab.left-toggle");
    await tab.click();

    // After click, app-body should have sidebar-open class
    const appBody = page.locator(".app-body");
    await expect(appBody).toHaveClass(/sidebar-open/);
  });

  test("clicking toggle tab again closes the sidebar", async ({ page, isMobile }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    const tab = page.locator(".sidebar-toggle-tab.left-toggle");
    await tab.click(); // open

    // On mobile the tab slides off-viewport after opening; dispatch directly via JS
    if (isMobile) {
      await page.evaluate(() => {
        (document.querySelector(".sidebar-toggle-tab.left-toggle") as HTMLElement | null)?.click();
      });
    } else {
      await tab.click(); // close
    }

    const appBody = page.locator(".app-body");
    await expect(appBody).not.toHaveClass(/sidebar-open/);
  });

  test("sidebar backdrop appears on mobile when sidebar is open", async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) test.skip();

    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    const tab = page.locator(".sidebar-toggle-tab.left-toggle");
    await tab.click();

    // Backdrop div is rendered by Navbar when sidebarToggled=true
    const backdrop = page.locator(".sidebar-backdrop");
    await expect(backdrop).toBeVisible();
  });

  test("clicking backdrop closes the sidebar", async ({ page, isMobile }) => {
    if (!isMobile) test.skip();

    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    const tab = page.locator(".sidebar-toggle-tab.left-toggle");
    await tab.click();

    const backdrop = page.locator(".sidebar-backdrop");
    await expect(backdrop).toBeVisible();
    // sidebar-content intercepts pointer events; dispatch click directly via JS
    await page.evaluate(() => {
      (document.querySelector(".sidebar-backdrop") as HTMLElement | null)?.click();
    });

    const appBody = page.locator(".app-body");
    await expect(appBody).not.toHaveClass(/sidebar-open/);
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

    const tab = page.locator(".sidebar-toggle-tab.left-toggle");
    await tab.click();

    // Wait for sidebar transition
    await page.waitForTimeout(300);

    expect(await hasNoHorizontalOverflow(page)).toBe(true);
  });
});
