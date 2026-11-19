import { test, expect, type Page } from "@playwright/test";
import { prepareRecipePage } from "../helpers/recipes";

const NOW = new Date(2026, 10, 18, 12, 0, 0);
const MINUTE = 60_000;

/** A JWT-shaped access token that expires at the given time (ms). */
const accessToken = (expiresAtMs: number) =>
  `h.${Buffer.from(JSON.stringify({ exp: Math.floor(expiresAtMs / 1000) })).toString("base64url")}.s`;

const pageNow = (page: Page) => page.evaluate(() => Date.now());

async function openApp(page: Page) {
  await page.clock.install({ time: NOW });
  await prepareRecipePage(page);
}

test.describe("session stays alive", () => {
  test("renews the token in the background so a later request never carries an expired one", async ({
    page,
  }) => {
    await openApp(page);
    let refreshes = 0;
    const staleRequests: number[] = [];
    let settingsCalls = 0;

    await page.route(
      (url) => url.pathname === "/auth/refresh",
      async (route) => {
        refreshes += 1;
        const now = await pageNow(page);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: accessToken(now + 15 * MINUTE) }),
        });
      },
    );
    // Stands in for any authenticated API call: rejects tokens that are expired by the page's clock.
    await page.route(
      (url) => url.pathname === "/api/planner/settings",
      async (route) => {
        settingsCalls += 1;
        const bearer = route.request().headers()["authorization"] ?? "";
        const payload = bearer.split(".")[1];
        const exp = payload
          ? JSON.parse(Buffer.from(payload, "base64url").toString()).exp * 1000
          : 0;
        if (exp <= (await pageNow(page))) staleRequests.push(exp);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            weekStartDay: 1,
            favoriteThreshold: 3,
            visibleSlots: ["dinner"],
            householdSize: 2,
          }),
        });
      },
    );

    await page.goto("/recipes");
    await expect.poll(() => refreshes).toBe(1); // restored on page load

    // 30 minutes of sitting idle, in steps so each background refresh can finish
    for (let minute = 14; minute <= 28; minute += 14) {
      await page.clock.runFor(14 * MINUTE);
      await expect.poll(() => refreshes).toBeGreaterThanOrEqual(1 + minute / 14);
    }
    expect(refreshes).toBeGreaterThanOrEqual(3);

    // The first API call after the idle period carries a live token and the user is still signed in
    await page.getByRole("link", { name: "My Planner" }).click();
    await expect.poll(() => settingsCalls).toBeGreaterThan(0);
    expect(staleRequests).toEqual([]);
    await expect(page).not.toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem("user"))).not.toBeNull();
  });

  test("a flaky network never signs the user out: it retries until the server answers", async ({
    page,
  }) => {
    await openApp(page);
    let attempts = 0;
    await page.route(
      (url) => url.pathname === "/auth/refresh",
      async (route) => {
        attempts += 1;
        if (attempts <= 2) return route.abort("connectionrefused");
        const now = await pageNow(page);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ accessToken: accessToken(now + 15 * MINUTE) }),
        });
      },
    );

    await page.goto("/recipes");
    await expect.poll(() => attempts).toBe(1);
    await page.clock.runFor(6_000); // first retry (5s) fails too
    await expect.poll(() => attempts).toBe(2);
    await page.clock.runFor(11_000); // second retry (10s) succeeds
    await expect.poll(() => attempts).toBe(3);

    await expect(page).not.toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem("user"))).not.toBeNull();
  });

  test("signs out and returns to the login page only when the server rejects the session", async ({
    page,
  }) => {
    await openApp(page);
    let logouts = 0;
    await page.route(
      (url) => url.pathname === "/auth/logout",
      (route) => {
        logouts += 1;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ message: "Logged out successfully" }),
        });
      },
    );
    await page.route(
      (url) => url.pathname === "/auth/refresh",
      (route) =>
        route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "Invalid or expired refresh token" }),
        }),
    );
    await page.route(
      (url) => url.pathname === "/auth/check",
      (route) =>
        route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unauthorized" }),
        }),
    );

    await page.goto("/recipes");
    await expect(page).toHaveURL(/\/login/);
    await expect.poll(() => logouts).toBeGreaterThanOrEqual(1);
  });
});
