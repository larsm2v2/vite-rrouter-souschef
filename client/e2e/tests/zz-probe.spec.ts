import { test } from "@playwright/test";

async function step(name: string, fn: () => Promise<unknown>) {
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("hung 4s")), 4000),
      ),
    ]);
    return `${name}:ok`;
  } catch (e) {
    return `${name}:FAIL(${String((e as Error).message).split("\n")[0]})`;
  }
}

test("probe keyboard delivery", async ({ page }, info) => {
  const out: string[] = [];
  out.push(
    await step("setContent", () =>
      page.setContent(
        `<button id="b" onclick="document.body.dataset.k=(document.body.dataset.k||'')+'[click]'">b</button><script>
          window.addEventListener('keydown', e => document.body.dataset.k=(document.body.dataset.k||'')+'['+e.key+']');
        </script>`,
      ),
    ),
  );
  out.push(
    await step("press-ArrowRight", () => page.keyboard.press("ArrowRight")),
  );
  out.push(
    await step("focus", () => page.locator("#b").focus({ timeout: 3000 })),
  );
  out.push(await step("press-Enter", () => page.keyboard.press("Enter")));
  const k = await step("read", async () =>
    page
      .evaluate(() => document.body.dataset.k ?? "(none)")
      .then((v) => out.push("keys=" + v)),
  );
  out.push(k);
  console.log(`PROBE ${info.project.name}: ${out.join(" | ")}`);
});
