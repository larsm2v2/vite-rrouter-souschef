import { test, expect } from "@playwright/test";

test("writes PKCE params before redirect", async ({ page }) => {
  // Intercept the Google OAuth navigation and redirect back to /login.
  // storePKCEParams() writes to localStorage BEFORE window.location.href fires,
  // so localStorage survives the cross-origin round-trip and is readable on return.
  await page.route("https://accounts.google.com/**", async (route) => {
    await route.fulfill({
      status: 302,
      headers: { Location: "http://127.0.0.1:5173/login?pkce_test=1" },
    });
  });

  await page.goto("/login");

  page.on("console", (m) =>
    console.log("PLAYWRIGHT_CLIENT_LOG:", m.type(), m.text()),
  );

  const button = page.getByRole("button", { name: /Sign in with Google/i });
  await expect(button).toBeVisible({ timeout: 2000 });
  await expect(button).toBeEnabled();

  const html = await button.evaluate((b) => b.outerHTML);
  console.log("BUTTON HTML:", html);

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

  console.log("PKCE-VERIFIER:", verifier);
  console.log("OAUTH-STATE:", state);

  expect(verifier && state).toBeTruthy();
});
