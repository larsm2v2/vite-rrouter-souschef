import { test, expect, Page } from "@playwright/test";

const user = {
  id: "import-review-test-user",
  email: "importreview@example.com",
  display_name: "Import Review Test",
};

const parsedRecipe = {
  name: "Parsed Soup",
  cuisine: "French",
  ingredients: { default: ["2 leeks"] },
  instructions: [{ number: 1, text: "Simmer the leeks." }],
  notes: [],
};

const ORIGINAL_TEXT = "SOUP\n2 leeks\nSimmer the leeks";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function preparePage(page: Page) {
  await page.addInitScript((testUser) => {
    localStorage.setItem("user", JSON.stringify(testUser));
    localStorage.setItem("accessToken", "test-access-token");
  }, user);

  const isApiCall = (url: URL) =>
    url.pathname.includes("/api/") || url.pathname.includes("/auth/");

  await page.route(
    (url) => isApiCall(url),
    async (route) => {
      const type = route.request().resourceType();
      if (type !== "xhr" && type !== "fetch") return route.continue();
      const url = new URL(route.request().url());
      const json = (body: unknown) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });

      if (url.pathname.includes("/auth/")) {
        return json({ authenticated: true, accessToken: "test-access-token" });
      }
      if (url.pathname.endsWith("/api/ocr/parse")) {
        return json({ parsed: parsedRecipe, text: ORIGINAL_TEXT });
      }
      if (url.pathname.endsWith("/api/ocr")) {
        return json({
          parsed: parsedRecipe,
          text: ORIGINAL_TEXT,
          imageUrls: ["/api/ocr/images/abc_soup.png"],
        });
      }
      if (url.pathname.endsWith("/api/grocery-list/version")) {
        return json({ listData: [] });
      }
      return json([]);
    },
  );
}

async function openTextReview(page: Page) {
  await page.goto("/sous-chef");
  await page.getByRole("button", { name: "Create Recipe" }).click();
  await page.getByRole("button", { name: "Text Editor" }).click();
  await page.getByLabel("OCR text editor").fill(ORIGINAL_TEXT);
  await page.getByRole("button", { name: "Parse Text on Server" }).click();
  await expect(
    page.getByRole("heading", { name: "Confirm parsed recipe" }),
  ).toBeVisible();
}

test.describe("Import review: original vs parsed", () => {
  test.beforeEach(async ({ page }) => {
    await preparePage(page);
  });

  test("pasted text can be compared with the parsed recipe", async ({
    page,
    isMobile,
  }) => {
    await openTextReview(page);

    if (isMobile) {
      // Starts on the parsed pane; the Original tab reveals the source text.
      await expect(page.getByRole("tab", { name: "Parsed" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.getByLabel("Name")).toHaveValue("Parsed Soup");

      await page.getByRole("tab", { name: "Original" }).click();
      await expect(page.getByRole("tab", { name: "Original" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page.locator(".review-text")).toContainText("2 leeks");

      await page.getByRole("tab", { name: "Parsed" }).click();
      await expect(page.getByLabel("Name")).toBeVisible();
    } else {
      // Wide screens show both panes side by side.
      await expect(page.locator(".review-text")).toContainText("2 leeks");
      await expect(page.getByLabel("Name")).toHaveValue("Parsed Soup");
    }
  });

  test("swiping sideways switches between original and parsed", async ({
    page,
    isMobile,
    browserName,
  }) => {
    test.skip(!isMobile, "Touch swipe only applies to phone layouts");
    test.skip(
      browserName !== "chromium",
      "Real touch swipes use the Chrome DevTools Protocol, which only Chromium has",
    );
    await openTextReview(page);

    const track = page.locator(".review-track");
    const box = (await track.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const y = box.y + 60;
    const x0 = box.x + box.width / 2;
    // A real finger drag: touchStart, a run of touchMoves, touchEnd.
    const swipe = async (dx: number) => {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: x0, y }],
      });
      for (let step = 1; step <= 10; step++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x0 + (dx * step) / 10, y }],
        });
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    };

    await swipe(box.width * 0.8); // drag right -> reveals the original pane
    await expect(page.getByRole("tab", { name: "Original" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator(".review-text")).toBeVisible();

    await swipe(-box.width * 0.8); // drag left -> back to the parsed pane
    await expect(page.getByRole("tab", { name: "Parsed" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByLabel("Name")).toBeVisible();
  });

  test("uploaded images stay visible next to the parsed result", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/sous-chef");
    await page.getByRole("button", { name: "Create Recipe" }).click();

    await page.getByLabel("Choose one or more images").setInputFiles({
      name: "soup.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(page.getByAltText("Preview of soup.png")).toBeVisible();

    await page.getByRole("button", { name: "Upload & Parse with AI" }).click();
    await expect(
      page.getByRole("heading", { name: "Confirm parsed recipe" }),
    ).toBeVisible();

    if (isMobile) {
      await page.getByRole("tab", { name: "Original" }).click();
    }
    const original = page.getByAltText("soup.png");
    await expect(original).toBeVisible();
    await expect(original).toHaveAttribute("src", /^blob:/);
    await expect(page.getByText("Recognized text")).toBeVisible();
  });

  test("tapping an original image toggles zoom", async ({ page, isMobile }) => {
    await page.goto("/sous-chef");
    await page.getByRole("button", { name: "Create Recipe" }).click();
    await page.getByLabel("Choose one or more images").setInputFiles({
      name: "soup.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await page.getByRole("button", { name: "Upload & Parse with AI" }).click();
    if (isMobile) await page.getByRole("tab", { name: "Original" }).click();

    const zoom = page.getByRole("button", { name: "Zoom soup.png" });
    await zoom.click();
    await expect(
      page.getByRole("button", { name: "Fit soup.png" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("Escape closes the modal and the next open starts fresh", async ({
    page,
  }) => {
    await openTextReview(page);
    await page.keyboard.press("Escape");
    await expect(page.locator(".ocr-modal")).toHaveCount(0);

    await page.getByRole("button", { name: "Create Recipe" }).click();
    await expect(page.getByLabel("Choose one or more images")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Confirm parsed recipe" }),
    ).toHaveCount(0);
  });

  test("the modal fits the phone viewport and keeps actions reachable", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Full-screen sheet only applies to phones");
    await openTextReview(page);

    const viewport = page.viewportSize()!;
    const modal = (await page.locator(".ocr-modal").boundingBox())!;
    expect(modal.width).toBeLessThanOrEqual(viewport.width);
    expect(modal.height).toBeLessThanOrEqual(viewport.height);

    const accept = page.getByRole("button", { name: "Accept & Import" });
    await expect(accept).toBeInViewport();
    const box = (await accept.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        (width) => document.documentElement.scrollWidth <= width,
        viewport.width,
      ),
    ).toBe(true);
  });
});
