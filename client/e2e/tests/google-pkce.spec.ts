import { test, expect } from "@playwright/test";

test("writes PKCE params before redirect", async ({ page }) => {
  // Intercept navigation so we can assert storage before leaving the app
  await page.addInitScript(() => {
    const origLocation = window.location;
    const stub = {
      href: origLocation.href,
      assign: (href: string) => {
        // store for debugging, don't navigate
        // store for debugging - test runtime global
        (window as unknown as { __lastRedirect__?: string }).__lastRedirect__ =
          href;
      },
    } as unknown as { href: string; assign: (s: string) => void };
    Object.defineProperty(window, "location", { value: stub });
  });

  // Navigate to login page
  await page.goto("http://127.0.0.1:5173/login");

  // Debug: print client console logs for troubleshooting
  page.on("console", (m) =>
    console.log("PLAYWRIGHT_CLIENT_LOG:", m.type(), m.text())
  );

  // Click the Google login button
  const button = page.getByRole("button", { name: /Sign in with Google/i });
  await expect(button).toBeVisible({ timeout: 2000 });
  await expect(button).toBeEnabled();
  // Debug: print outerHTML
  const html = await button.evaluate((b) => b.outerHTML);
  console.log("BUTTON HTML:", html);
  await button.click();

  // Debug: print client console logs for troubleshooting
  page.on("console", (m) =>
    console.log("PLAYWRIGHT_CLIENT_LOG:", m.type(), m.text())
  );

  // Wait for the client log that verifies PKCE was created. This is a
  // reliable signal the storePath has executed and helps avoid cross-context
  // sessionStorage access edge cases.
  await page.waitForEvent("console", {
    predicate: (m) => m.text().includes("WRITING PKCE"),
    timeout: 3000,
  });

  // Read sessionStorage directly
  const pkceVerifier = await page.evaluate(() =>
    sessionStorage.getItem("pkce_verifier")
  );
  const oauthState = await page.evaluate(() =>
    sessionStorage.getItem("oauth_state")
  );

  // Also check localStorage (cross-tab fallback)
  const pkceVerifierLocal = await page.evaluate(() =>
    localStorage.getItem("pkce_verifier")
  );
  const oauthStateLocal = await page.evaluate(() =>
    localStorage.getItem("oauth_state")
  );

  // Diagnostics
  console.log("PKCE-VERIFIER:", pkceVerifier);
  console.log("OAUTH-STATE:", oauthState);

  // Assertions: Accept either sessionStorage OR localStorage presence
  const hasSession = Boolean(pkceVerifier && oauthState);
  const hasLocal = Boolean(pkceVerifierLocal && oauthStateLocal);

  expect(hasSession || hasLocal).toBeTruthy();
});
