import type { Page } from "@playwright/test";

/** A real finger drag using CDP touch events (synthesized scroll gestures do not move scroll-snap tracks). */
export async function touchSwipe(
  page: Page,
  from: { x: number; y: number },
  dx: number,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [from],
  });
  for (let step = 1; step <= 10; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from.x + (dx * step) / 10, y: from.y }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}
