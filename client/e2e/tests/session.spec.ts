import { test, expect, type Page } from "@playwright/test";
import { prepareRecipePage, TEST_USER } from "../helpers/recipes";

const NOW = new Date(2026, 10, 18, 12, 0, 0);
const MINUTE = 60_000;

/** A JWT-shaped access token that expires at the given time (ms). */
const accessToken = (expiresAtMs: number) =>
  `h.${Buffer.from(JSON.stringify({ exp: Math.floor(expiresAtMs / 1000) })).toString("base64url")}.s`;

const pageNow = (page: Page) => page.evaluate(() => Date.now());

async function waitForRefreshCompletion(page: Page) {
  // Let the response update the token and its timer before advancing the mock clock.
  await page.evaluate(() =>
    navigator.locks?.request("souschef-session-refresh", () => undefined),
  );
}

async function openApp(page: Page) {
  await page.clock.install({ time: NOW });
  await prepareRecipePage(page);
}

test.describe("session stays alive", () => {
  test("login stores a first-party HttpOnly cookie eligible for renewal", async ({
    page,
  }) => {
    await page.clock.install({ time: NOW });
    await page.clock.pauseAt(new Date(NOW.getTime() + 1_000));
    await prepareRecipePage(page, undefined, { seedUser: false });
    let refreshes = 0;
    await page.route(
      (url) => url.pathname === "/auth/login",
      async (route) => {
        expect(new URL(route.request().url()).origin).toBe(
          new URL(page.url()).origin,
        );
        await route.fulfill({
          headers: {
            "Set-Cookie": "__session=browser-session; Path=/; HttpOnly; SameSite=Lax",
          },
          json: {
            accessToken: accessToken((await pageNow(page)) + 2 * MINUTE),
            user: TEST_USER,
          },
        });
      },
    );
    await page.route(
      (url) => url.pathname === "/auth/refresh",
      async (route) => {
        expect(new URL(route.request().url()).origin).toBe(
          new URL(page.url()).origin,
        );
        // WebKit interception precedes Cookie-header assembly; inspect URL-scoped cookies.
        expect(await page.context().cookies(route.request().url())).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              name: "__session",
              value: "browser-session",
              httpOnly: true,
            }),
          ]),
        );
        refreshes += 1;
        await route.fulfill({
          json: { accessToken: accessToken((await pageNow(page)) + 2 * MINUTE) },
        });
      },
    );
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(TEST_USER.email);
    await page.getByLabel("Password", { exact: true }).fill("test-password");
    await page
      .locator("form")
      .getByRole("button", { name: "Login", exact: true })
      .click();
    await expect(page).toHaveURL(/\/profile$/);
    expect(await page.evaluate(() => document.cookie)).not.toContain("__session");

    await page.goto("/recipes/7");
    await expect.poll(() => refreshes).toBe(1);
    await waitForRefreshCompletion(page);
    await page.clock.runFor(MINUTE);
    await expect.poll(() => refreshes).toBe(2);
    await expect(page).not.toHaveURL(/\/login/);
  });

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
    await waitForRefreshCompletion(page);

    // 30 minutes of sitting idle, in steps so each background refresh can finish
    for (let minute = 14; minute <= 28; minute += 14) {
      await page.clock.runFor(14 * MINUTE);
      await expect.poll(() => refreshes).toBeGreaterThanOrEqual(1 + minute / 14);
      await waitForRefreshCompletion(page);
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
    expect(logouts).toBe(0);
  });

  for (const sameUser of [true, false]) {
    test(`session expiry ${sameUser ? "restores cooking for the same account" : "keeps cooking private from another account"}`, async ({
      page,
    }) => {
      await page.clock.install({ time: NOW });
      await page.clock.pauseAt(new Date(NOW.getTime() + 1_000));
      await prepareRecipePage(page, undefined, { seedUser: false });
      let loginUser = TEST_USER;
      let expired = false;
      let logouts = 0;
      await page.route(
        (url) => url.pathname === "/auth/login",
        async (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              accessToken: accessToken((await pageNow(page)) + 2 * MINUTE),
              user: loginUser,
            }),
          }),
      );
      await page.route(
        (url) => url.pathname === "/auth/refresh",
        async (route) =>
          route.fulfill({
            status: expired ? 401 : 200,
            contentType: "application/json",
            body: JSON.stringify(
              expired
                ? { error: "Refresh token required" }
                : {
                    accessToken: accessToken((await pageNow(page)) + 2 * MINUTE),
                  },
            ),
          }),
      );
      await page.route(
        (url) => url.pathname === "/auth/logout",
        (route) => {
          logouts += 1;
          return route.fulfill({ json: { message: "Logged out successfully" } });
        },
      );
      const signIn = async () => {
        await page.getByLabel("Email", { exact: true }).fill(loginUser.email);
        await page.getByLabel("Password", { exact: true }).fill("test-password");
        await page
          .locator("form")
          .getByRole("button", { name: "Login", exact: true })
          .click();
        await expect(page).toHaveURL(/\/profile$/);
      };

      await page.goto("/login");
      await signIn();
      await page.goto("/recipes/7");
      await page.getByRole("button", { name: "Scale 2×" }).click();
      await page.getByRole("checkbox", { name: "3 cups flour" }).check();
      await page.getByRole("link", { name: "Start cooking" }).click();
      await page.getByRole("button", { name: "Next" }).click();
      await page.getByRole("button", { name: "Start 10 minutes timer" }).click();
      await expect(
        page.getByRole("region", { name: "Timers" }).getByText("10:00"),
      ).toBeVisible();
      await page.evaluate(() => {
        localStorage.setItem("selectedRecipeIds", '["7"]');
      });
      const saved = await page.evaluate(() =>
        Object.fromEntries(
          Object.entries(localStorage).filter(([key]) =>
            key.startsWith("souschef:v1:"),
          ),
        ),
      );

      expired = true;
      await page.clock.runFor(MINUTE);
      await expect(page).toHaveURL(/\/login$/);
      const afterExpiry = await page.evaluate(() => ({
        user: localStorage.getItem("user"),
        accessToken: localStorage.getItem("accessToken"),
        selectedRecipeIds: localStorage.getItem("selectedRecipeIds"),
        saved: Object.fromEntries(
          Object.entries(localStorage).filter(([key]) =>
            key.startsWith("souschef:v1:"),
          ),
        ),
      }));
      expect(afterExpiry.user).toBeNull();
      expect(afterExpiry.accessToken).toBeNull();
      expect(afterExpiry.selectedRecipeIds).toBeNull();
      expect(afterExpiry.saved).toEqual(saved);
      expect(logouts).toBe(0);

      await page.clock.runFor(MINUTE);
      expired = false;
      if (!sameUser) {
        loginUser = {
          ...TEST_USER,
          id: "another-cook",
          email: "other@example.com",
        };
      }
      await signIn();
      await page.goto("/recipes/7");
      if (sameUser) {
        await expect(
          page.getByRole("checkbox", { name: "3 cups flour" }),
        ).toBeChecked();
        await expect(
          page.getByRole("region", { name: "Timers" }).getByText("8:00"),
        ).toBeVisible();
        await page.getByRole("link", { name: "Resume cooking" }).click();
        await expect(page.getByText("Step 2 of 3")).toBeVisible();
      } else {
        await expect(
          page.getByRole("checkbox", { name: "1 ½ cups flour" }),
        ).not.toBeChecked();
        await expect(page.getByRole("region", { name: "Timers" })).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Start cooking" }),
        ).toBeVisible();
      }
    });
  }
});
