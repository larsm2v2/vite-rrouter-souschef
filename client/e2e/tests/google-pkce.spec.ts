import { test, expect } from "@playwright/test";
import { getGoogleRedirectUri } from "../../src/utils/pkce";
import { prepareRecipePage, TEST_USER } from "../helpers/recipes";

test("Google callback exchanges its code on the app origin", async ({ page }) => {
  await prepareRecipePage(page, undefined, { seedUser: false });
  let exchanges = 0;
  await page.route("https://accounts.google.com/**", async (route) => {
    const state = new URL(route.request().url()).searchParams.get("state");
    const callback = new URL("/auth/callback", page.url());
    callback.searchParams.set("code", "browser-test-code");
    callback.searchParams.set("state", state ?? "");
    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><script>window.location.replace(${JSON.stringify(callback.href)})</script>`,
    });
  });
  await page.route(
    (url) => url.pathname === "/api/oauth/google/token",
    async (route) => {
      expect(new URL(route.request().url()).origin).toBe(
        new URL(page.url()).origin,
      );
      expect(route.request().postDataJSON()).toMatchObject({
        code: "browser-test-code",
        redirect_uri: new URL("/auth/callback", page.url()).href,
      });
      exchanges += 1;
      await route.fulfill({
        headers: {
          "Set-Cookie": "__session=google-session; Path=/; HttpOnly; SameSite=Lax",
        },
        json: { access_token: "google-test-access", user: TEST_USER },
      });
    },
  );
  await page.goto("/login");
  await page.getByRole("button", { name: /Sign in with Google/i }).click();
  await expect(page).toHaveURL(/\/profile$/);
  expect(exchanges).toBe(1);
  expect(await page.context().cookies()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "__session",
        value: "google-session",
        httpOnly: true,
      }),
    ]),
  );
});

test("uses a same-origin frontend callback URI for PKCE", () => {
  expect(getGoogleRedirectUri("https://recipes.example.org")).toBe(
    "https://recipes.example.org/auth/callback",
  );
  expect(
    getGoogleRedirectUri(
      "https://recipes.example.org",
      "https://recipes.example.org/auth/callback",
    ),
  ).toBe("https://recipes.example.org/auth/callback");
  expect(() =>
    getGoogleRedirectUri(
      "https://recipes.example.org",
      "https://api.example.org/auth/callback",
    ),
  ).toThrow("must be this app's /auth/callback URL");
});

test("writes PKCE params before redirect", async ({ page }) => {
  await page.goto("/login");
  const returnUrl = new URL("/login?pkce_test=1", page.url()).href;
  // Intercept the Google OAuth navigation and redirect back to /login.
  // storePKCEParams() writes to localStorage BEFORE window.location.href fires,
  // so localStorage survives the cross-origin round-trip and is readable on return.
  await page.route("https://accounts.google.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><script>window.location.replace(${JSON.stringify(returnUrl)})</script>`,
    });
  });

  const button = page.getByRole("button", { name: /Sign in with Google/i });
  await expect(button).toBeVisible({ timeout: 2000 });
  await expect(button).toBeEnabled();

  await button.click();

  // Poll localStorage until pkce_code_verifier appears.
  // Works for all browsers:
  //   - No clientId: page stays on /login; storePKCEParams wrote to localStorage
  //     before the clientId guard threw.
  //   - ClientId set: page navigates to Google → route redirects back to /login;
  //     localStorage persists across same-origin page reloads.
  // The try/catch swallows SecurityErrors while the page context is in transit.
  let verifier: string | null = null;
  let state: string | null = null;

  await expect
    .poll(
      async () => {
        try {
          verifier = await page.evaluate(() =>
            localStorage.getItem("pkce_code_verifier"),
          );
          state = await page.evaluate(() =>
            localStorage.getItem("oauth_state"),
          );
          return verifier && state;
        } catch {
          return null;
        }
      },
      { timeout: 8000 },
    )
    .toBeTruthy();

  expect(verifier && state).toBeTruthy();
});
