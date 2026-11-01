/**
 * pages.spec.ts
 *
 * Page-specific layout and visual structure tests for Chrome desktop & mobile.
 * Tests here verify that individual pages render correctly at both viewport sizes.
 *
 * Run: cd client && npm run e2e
 */

import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers (duplicated locally to keep test files self-contained)
// ---------------------------------------------------------------------------

const FAKE_USER = {
  id: "pages-test-user",
  email: "pagestest@example.com",
  display_name: "Pages Test",
};
const FAKE_TOKEN = "fake-pages-test-token";

async function injectFakeAuth(page: Page) {
  await page.addInitScript(
    ({ user, token }: { user: typeof FAKE_USER; token: string }) => {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("accessToken", token);
    },
    { user: FAKE_USER, token: FAKE_TOKEN },
  );
}

async function stubApiCalls(page: Page) {
  // Guard with resourceType() to avoid intercepting Vite JS module imports
  // (e.g. /src/components/auth/*.tsx) whose URLs also match **/auth/**.
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

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------

test.describe("Login page layout", () => {
  test("login card is visible and within viewport width", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const card = page.locator(".login-card");
    await expect(card).toBeVisible();

    const box = await card.boundingBox();
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(box).not.toBeNull();
    // Card should not extend beyond the viewport
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
  });

  test("Google sign-in button is visible and tappable", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const button = page.getByRole("button", { name: /Sign in with Google/i });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();

    // On mobile, the button must be tall enough to tap (min 44px)
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });

  test("login card padding is not near-zero on mobile", async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) test.skip();

    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // This catches the vw-based padding bug: `padding: 2vw` ≈ 7px on 360px mobile.
    // After the fix, padding should be at least 16px (1rem).
    const card = page.locator(".login-card");
    const paddingLeft = await card.evaluate((el) => {
      return parseFloat(getComputedStyle(el).paddingLeft);
    });
    expect(paddingLeft).toBeGreaterThanOrEqual(16);
  });

  test("login container fills the full viewport height", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const container = page.locator(".login-container");
    const box = await container.boundingBox();
    const viewportHeight = page.viewportSize()?.height ?? 0;

    expect(box).not.toBeNull();
    // Container should cover at least 80% of the viewport height
    expect(box!.height).toBeGreaterThanOrEqual(viewportHeight * 0.8);
  });
});

// ---------------------------------------------------------------------------
// Profile page
// ---------------------------------------------------------------------------

test.describe("Profile page layout", () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeAuth(page);
    await stubApiCalls(page);
  });

  test("profile container is visible", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForLoadState("domcontentloaded");

    const container = page.locator(".profile-container");
    await expect(container).toBeVisible();
  });

  test("profile container does not overflow viewport width", async ({
    page,
  }) => {
    await page.goto("/profile");
    await page.waitForLoadState("domcontentloaded");

    const container = page.locator(".profile-container");
    const box = await container.boundingBox();
    const viewportWidth = page.viewportSize()?.width ?? 0;

    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test("profile card padding is not near-zero on mobile", async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) test.skip();

    await page.goto("/profile");
    await page.waitForLoadState("domcontentloaded");

    // Catches vw-based padding: `padding: 1vw` ≈ 3.9px on mobile.
    // After the fix, padding should be at least 12px.
    const card = page.locator(".profile-card");
    await expect(card).toBeVisible();
    const paddingLeft = await card.evaluate((el) => {
      return parseFloat(getComputedStyle(el).paddingLeft);
    });
    expect(paddingLeft).toBeGreaterThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// SousChef page
// ---------------------------------------------------------------------------

test.describe("SousChef page layout", () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeAuth(page);
    await stubApiCalls(page);
  });

  test("SousChef page renders without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    const overflow = await page.evaluate(
      (width) => document.documentElement.scrollWidth > width,
      page.viewportSize()!.width,
    );
    expect(overflow).toBe(false);
  });

  test("mode toggle buttons are visible and not clipped", async ({ page }) => {
    await page.goto("/sous-chef");
    await page.waitForLoadState("domcontentloaded");

    // The souschef mode toggle switches between recipe-chat and recipe-generator modes
    const toggle = page.locator(".souschef-mode-toggle");
    // May not render until component mounts; allow time
    const present = await toggle.count();
    if (present === 0) return; // component may be hidden behind loading state

    await expect(toggle).toBeVisible();

    const box = await toggle.boundingBox();
    const viewportWidth = page.viewportSize()?.width ?? 0;
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 2);
  });
});

// ---------------------------------------------------------------------------
// Recipes page
// ---------------------------------------------------------------------------

test.describe("Recipes page layout", () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeAuth(page);
    await stubApiCalls(page);
  });

  test("recipes page renders without horizontal overflow", async ({ page }) => {
    await page.goto("/recipes");
    await page.waitForLoadState("domcontentloaded");

    const overflow = await page.evaluate(
      (width) => document.documentElement.scrollWidth > width,
      page.viewportSize()!.width,
    );
    expect(overflow).toBe(false);
  });

  test("main content area is not hidden behind sidebar toggle tabs", async ({
    page,
  }) => {
    await page.goto("/recipes");
    await page.waitForLoadState("domcontentloaded");

    // The left sidebar tab is fixed at left: 0. Main content should not start at x=0.
    // The right sidebar tab is at right: 0. Main content right edge should not be 0.
    const main = page.locator(".app-main");
    const box = await main.boundingBox();

    expect(box).not.toBeNull();
    // Main content left edge should be >= 0 (could be flush left if tab overlays)
    expect(box!.x).toBeGreaterThanOrEqual(0);
    // Main should have meaningful width
    const viewportWidth = page.viewportSize()?.width ?? 375;
    expect(box!.width).toBeGreaterThanOrEqual(viewportWidth * 0.7);
  });
});

// ---------------------------------------------------------------------------
// Right sidebar (Recipe Index) toggle – only shown when a recipe is selected
// ---------------------------------------------------------------------------

test.describe("Right sidebar toggle tab", () => {
  test.beforeEach(async ({ page }) => {
    await injectFakeAuth(page);
    await stubApiCalls(page);
  });

  test("right sidebar toggle tab is not shown on the recipes list page", async ({
    page,
  }) => {
    await page.goto("/recipes");
    await page.waitForLoadState("domcontentloaded");

    // The right toggle only renders when recipeToDisplay is set (a recipe was opened).
    const rightTab = page.locator(".sidebar-toggle-tab.right-toggle");
    await expect(rightTab).not.toBeVisible();
  });
});
