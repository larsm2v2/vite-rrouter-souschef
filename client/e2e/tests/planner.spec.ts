import { test, expect, type Page } from "@playwright/test";
import {
  prepareRecipePage,
  stringRecipe,
  structuredRecipe,
} from "../helpers/recipes";

interface Entry {
  id: number;
  recipeId: number | null;
  recipeName: string | null;
  plannedDate: string;
  mealType: string;
  isCooked: boolean;
  kind: "meal" | "leftover";
  sourceEntryId: number | null;
  multiplier: number;
  leftoverCount: number;
}

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

const NOW = new Date(2026, 10, 18, 12, 0, 0); // Wednesday 2026-11-18

const HISTORY = [
  {
    weekStart: "2026-11-09",
    weekEnd: "2026-11-15",
    plannedCount: 2,
    cookedCount: 1,
    entries: [
      {
        id: 1,
        recipeId: 8,
        recipeName: "Structured Soup",
        plannedDate: "2026-11-10",
        mealType: "dinner",
        isCooked: true,
      },
      {
        id: 2,
        recipeId: null,
        recipeName: "Deleted Dish",
        plannedDate: "2026-11-12",
        mealType: "lunch",
        isCooked: false,
      },
    ],
  },
];

const ALL_SLOTS = ["breakfast", "lunch", "dinner", "snack"];

/** Stateful fake of the meal-plan API; records every mutating call. */
async function installPlannerApi(
  page: Page,
  options: { visibleSlots?: string[]; seed?: Entry[] } = {},
) {
  await prepareRecipePage(page, {
    "7": { ...stringRecipe, is_favorite: true, cook_count: 4 },
    "8": structuredRecipe,
  });
  const entries: Entry[] = [...(options.seed ?? [])];
  const calls: Call[] = [];
  let nextId = 100;
  let weekStartDay = 1;
  let visibleSlots = options.visibleSlots ?? ALL_SLOTS;
  let householdSize = 2;

  await page.route(
    (url) =>
      url.pathname.startsWith("/api/meal-plan") ||
      url.pathname.startsWith("/api/planner") ||
      url.pathname.endsWith("/add-to-grocery-list"),
    async (route) => {
      const type = route.request().resourceType();
      if (type !== "xhr" && type !== "fetch") return route.fallback();
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const body =
        method === "GET" || method === "DELETE"
          ? null
          : (request.postDataJSON() as Record<string, unknown>);
      const json = (data: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (method !== "GET") calls.push({ method, path: url.pathname, body });

      if (url.pathname.endsWith("/add-to-grocery-list"))
        return json({ success: true, itemsAdded: 5, skippedStaples: ["salt"] });

      if (url.pathname === "/api/planner/settings") {
        if (method === "PUT" && body) {
          if (typeof body.weekStartDay === "number")
            weekStartDay = body.weekStartDay;
          if (Array.isArray(body.visibleSlots))
            visibleSlots = ALL_SLOTS.filter((s) =>
              (body.visibleSlots as string[]).includes(s),
            );
          if (typeof body.householdSize === "number")
            householdSize = body.householdSize;
        }
        return json({
          weekStartDay,
          favoriteThreshold: 3,
          visibleSlots,
          householdSize,
        });
      }
      if (url.pathname === "/api/meal-plan/history") return json(HISTORY);
      if (url.pathname === "/api/meal-plan/copy-week")
        return json([{ id: 500 }, { id: 501 }], 201);

      const leftoverMatch = /^\/api\/meal-plan\/(\d+)\/leftovers$/.exec(
        url.pathname,
      );
      if (leftoverMatch) {
        const source = entries.find((e) => e.id === Number(leftoverMatch[1]));
        if (!source) return json({ error: "not found" }, 404);
        const created = (body?.slots as { plannedDate: string; mealType: string }[]).map(
          (slot) => ({
            ...source,
            id: nextId++,
            kind: "leftover" as const,
            sourceEntryId: source.id,
            multiplier: 1,
            leftoverCount: 0,
            isCooked: false,
            plannedDate: slot.plannedDate,
            mealType: slot.mealType,
          }),
        );
        entries.push(...created);
        source.leftoverCount += created.length;
        return json(created, 201);
      }

      const idMatch = /^\/api\/meal-plan\/(\d+)(\/cooked)?$/.exec(url.pathname);
      if (idMatch) {
        const entry = entries.find((e) => e.id === Number(idMatch[1]));
        if (!entry) return json({ error: "not found" }, 404);
        if (idMatch[2]) {
          entry.isCooked = body?.cooked !== false;
          return json({
            entry,
            completion:
              entry.kind === "leftover"
                ? null
                : {
                    recorded: true,
                    cookCount: 3,
                    isFavorite: true,
                    autoFavorited: true,
                  },
          });
        }
        if (method === "PATCH") {
          Object.assign(entry, body);
          return json(entry);
        }
        if (method === "DELETE") {
          for (const child of entries.filter((e) => e.sourceEntryId === entry.id))
            entries.splice(entries.indexOf(child), 1);
          entries.splice(entries.indexOf(entry), 1);
          return json({ success: true });
        }
      }

      if (url.pathname === "/api/meal-plan") {
        if (method === "POST") {
          const recipe = body?.recipeId === 7 ? stringRecipe : structuredRecipe;
          const entry: Entry = {
            id: nextId++,
            recipeId: Number(body?.recipeId),
            recipeName: recipe.name,
            plannedDate: String(body?.plannedDate),
            mealType: String(body?.mealType),
            isCooked: false,
            kind: "meal",
            sourceEntryId: null,
            multiplier: 1,
            leftoverCount: 0,
          };
          entries.push(entry);
          return json(entry, 201);
        }
        const start = url.searchParams.get("start") ?? "";
        const end = url.searchParams.get("end") ?? "";
        return json(
          entries.filter((e) => e.plannedDate >= start && e.plannedDate <= end),
        );
      }
      return route.fallback();
    },
  );
  return { entries, calls };
}

const day = (page: Page, label: RegExp) =>
  page.getByRole("region", { name: label });
const slot = (page: Page, label: RegExp, name: string) =>
  day(page, label).locator(`[data-slot="${name}"]`);

/** Open the planner and wait until data has loaded so layout is stable before dragging. */
async function openPlanner(page: Page) {
  await page.goto("/planner");
  await expect(page.locator(".planner-main")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".planner-recipe").first()).toBeVisible();
}

async function mouseDrag(
  page: Page,
  from: ReturnType<Page["locator"]>,
  to: ReturnType<Page["locator"]>,
) {
  await expect(from).toBeVisible();
  await expect(to).toBeVisible();
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 12, {
    steps: 4,
  });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
  // Let dnd-kit resolve the drop target for the final pointer position before releasing.
  await page.waitForTimeout(150);
  await page.mouse.up();
}

test.describe("meal planner", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test("shows the current Mon-Sun week with today highlighted", async ({
    page,
  }) => {
    await installPlannerApi(page);
    await page.goto("/planner");
    await expect(page.getByText(/Nov 16 – Nov 22, 2026/)).toBeVisible();
    await expect(page.locator(".planner-day")).toHaveCount(7);
    await expect(page.locator(".planner-day.today")).toContainText("Wed");
    // favorites rank first in the palette
    await expect(page.locator(".planner-recipe").first()).toContainText(
      "Imported Soup",
    );
  });

  test("drag a recipe onto a slot, move it, check it off, and remove with undo", async ({
    page,
  }) => {
    const api = await installPlannerApi(page);
    await openPlanner(page);

    const palette = page.locator(".planner-recipe", {
      hasText: "Imported Soup",
    });
    await mouseDrag(page, palette, slot(page, /Thu, Nov 19/, "dinner"));
    await expect(
      slot(page, /Thu, Nov 19/, "dinner").getByText("Imported Soup"),
    ).toBeVisible();
    // Cards can only be dragged once saved (their checkbox enables at the same time)
    await expect(
      slot(page, /Thu, Nov 19/, "dinner").getByRole("checkbox"),
    ).toBeEnabled();
    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({
        method: "POST",
        path: "/api/meal-plan",
        body: { recipeId: 7, plannedDate: "2026-11-19", mealType: "dinner" },
      });

    await mouseDrag(
      page,
      slot(page, /Thu, Nov 19/, "dinner").getByRole("button", {
        name: /Drag Imported Soup/,
      }),
      slot(page, /Fri, Nov 20/, "lunch"),
    );
    await expect(
      slot(page, /Fri, Nov 20/, "lunch").getByText("Imported Soup"),
    ).toBeVisible();
    await expect(
      slot(page, /Thu, Nov 19/, "dinner").getByText("Imported Soup"),
    ).toHaveCount(0);
    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({
        method: "PATCH",
        body: { plannedDate: "2026-11-20", mealType: "lunch" },
      });

    const friLunch = slot(page, /Fri, Nov 20/, "lunch");
    await friLunch
      .getByRole("checkbox", { name: /Mark Imported Soup as cooked/ })
      .check();
    await expect(page.getByText(/now a favorite \(cooked 3 times\)/)).toBeVisible();
    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({
        path: expect.stringMatching(/\/cooked$/),
        body: { cooked: true },
      });

    // Undo is a pure local revert: nothing is deleted on the server
    await friLunch.getByRole("button", { name: /Remove Imported Soup/ }).click();
    await expect(friLunch.getByText("Imported Soup")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(friLunch.getByText("Imported Soup")).toBeVisible();
    expect(api.calls.filter((c) => c.method === "DELETE")).toHaveLength(0);

    // Without undoing, the delete is sent once the toast closes (pointer away so it is not held open)
    await friLunch.getByRole("button", { name: /Remove Imported Soup/ }).click();
    await page.mouse.move(0, 0);
    await expect
      .poll(() => api.calls.filter((c) => c.method === "DELETE").length, {
        timeout: 25_000,
      })
      .toBe(1);
  });

  test("adds a recipe with the + picker (no dragging needed)", async ({
    page,
  }) => {
    const api = await installPlannerApi(page);
    await openPlanner(page);
    await page
      .getByRole("button", { name: /Add a recipe to Breakfast on Mon, Nov 16/ })
      .click();
    await page
      .getByLabel(/Recipe for Breakfast on Mon, Nov 16/)
      .selectOption({ label: "Structured Soup" });
    await expect(
      slot(page, /Mon, Nov 16/, "breakfast").getByText("Structured Soup"),
    ).toBeVisible();
    await expect
      .poll(() => api.calls.at(-1)?.body)
      .toMatchObject({ recipeId: 8, mealType: "breakfast" });
  });

  test("navigates weeks, custom ranges and the week start day", async ({
    page,
  }) => {
    const api = await installPlannerApi(page);
    await page.goto("/planner");

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/Nov 23 – Nov 29, 2026/)).toBeVisible();
    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByText(/Nov 16 – Nov 22, 2026/)).toBeVisible();

    await page.getByRole("tab", { name: "Settings" }).click();
    await page.getByLabel("Week starts on").selectOption({ label: "Sunday" });
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({ method: "PUT", body: { weekStartDay: 0 } });
    await page.getByRole("tab", { name: "Plan" }).click();
    await expect(page.getByText(/Nov 15 – Nov 21, 2026/)).toBeVisible();

    await page.getByRole("button", { name: "Custom range" }).click();
    await page.getByLabel("From", { exact: true }).fill("2026-11-01");
    await page.getByLabel("To", { exact: true }).fill("2026-11-10");
    await page.getByRole("button", { name: "Show", exact: true }).click();
    await expect(page.locator(".planner-day")).toHaveCount(10);
    await expect(page.getByText(/\(custom\)/)).toBeVisible();

    // a successful apply closes the form; reopen it for an oversized range
    await page.getByRole("button", { name: "Custom range" }).click();
    await page.getByLabel("From", { exact: true }).fill("2026-01-01");
    await page.getByLabel("To", { exact: true }).fill("2026-06-01");
    await page.getByRole("button", { name: "Show", exact: true }).click();
    await expect(page.getByText(/at most 42 days/)).toBeVisible();
  });

  test("history lists past weeks and reuses one for this week", async ({
    page,
  }) => {
    const api = await installPlannerApi(page);
    await page.goto("/planner");
    await page.getByRole("tab", { name: "History" }).click();

    const week = page.locator(".history-week");
    await expect(week).toContainText("Nov 9 – Nov 15, 2026");
    await expect(week).toContainText("1/2 cooked");
    await expect(week.getByText("Deleted Dish")).toBeVisible();

    await week.getByRole("button", { name: "Reuse for this week" }).click();
    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({
        path: "/api/meal-plan/copy-week",
        body: { fromStart: "2026-11-09", toStart: "2026-11-16" },
      });
    // jumps to the planner on the copied week
    await expect(page.getByText(/Nov 16 – Nov 22, 2026/)).toBeVisible();
  });
});

const mealEntry = (over: Partial<Entry>): Entry => ({
  id: 1,
  recipeId: 7,
  recipeName: "Imported Soup",
  plannedDate: "2026-11-17",
  mealType: "dinner",
  isCooked: false,
  kind: "meal",
  sourceEntryId: null,
  multiplier: 1,
  leftoverCount: 0,
  ...over,
});

test.describe("meal slots, settings tab, multiplier and leftovers", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test("defaults to dinners only but keeps a hidden slot visible where it holds a meal", async ({
    page,
  }) => {
    await installPlannerApi(page, {
      visibleSlots: ["dinner"],
      seed: [mealEntry({ id: 1, plannedDate: "2026-11-17", mealType: "breakfast" })],
    });
    await openPlanner(page);
    await expect(page.locator('[data-slot="lunch"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="snack"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="dinner"]')).toHaveCount(7);
    // Tuesday's breakfast holds a meal, so only that day's breakfast shows
    await expect(page.locator('[data-slot="breakfast"]')).toHaveCount(7);
    await expect(
      slot(page, /Tue, Nov 17/, "breakfast").getByText("Imported Soup"),
    ).toBeVisible();
  });

  test("the Settings tab changes the visible meals, validates, and saves", async ({
    page,
  }) => {
    const api = await installPlannerApi(page, { visibleSlots: ["dinner"] });
    await openPlanner(page);
    await page.getByRole("tab", { name: "Settings" }).click();

    await page.getByRole("button", { name: "Breakfast + Dinner" }).click();
    await expect(page.getByLabel("Breakfast")).toBeChecked();
    await expect(page.getByLabel("Lunch")).not.toBeChecked();

    // at least one meal must stay selected
    await page.getByLabel("Breakfast").uncheck();
    await page.getByLabel("Dinner").uncheck();
    await expect(page.getByText("Choose at least one meal.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save settings" })).toBeDisabled();

    await page.getByRole("button", { name: "Breakfast + Dinner" }).click();
    await page.getByLabel("People in your household").fill("4");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({
        method: "PUT",
        body: { visibleSlots: ["breakfast", "dinner"], householdSize: 4 },
      });

    await page.getByRole("tab", { name: "Plan" }).click();
    await expect(page.locator('[data-slot="breakfast"]')).toHaveCount(7);
    await expect(page.locator('[data-slot="dinner"]')).toHaveCount(7);
    await expect(page.locator('[data-slot="lunch"]')).toHaveCount(0);
  });

  test("scales a meal, suggests leftovers from servings, and adds them as linked cards", async ({
    page,
  }) => {
    const api = await installPlannerApi(page, {
      visibleSlots: ["lunch", "dinner"],
      seed: [mealEntry({ id: 1, plannedDate: "2026-11-17", mealType: "dinner" })],
    });
    await openPlanner(page);
    const card = slot(page, /Tue, Nov 17/, "dinner");
    await card.getByRole("button", { name: /Options for Imported Soup/ }).click();

    // 4 servings x 1 for a household of 2 feeds two meals: one cooked now, one leftover
    await expect(
      card.getByText(/Makes about 4 servings for 2 people — roughly 1 leftover meal\./),
    ).toBeVisible();
    await card.getByLabel(/Recipe multiplier for Imported Soup/).selectOption("3");
    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({ method: "PATCH", body: { multiplier: 3 } });
    await expect(card.getByText("×3", { exact: true })).toBeVisible();
    // 12 servings / 2 people = 6 meals, 5 of them leftovers
    await expect(card.getByText(/roughly 5 leftover meals/)).toBeVisible();

    const group = card.getByRole("group", { name: "Make leftovers" });
    await expect(group.getByRole("checkbox", { checked: true })).toHaveCount(5);
    // lunch and dinner are the visible slots, so the first suggestion is Wednesday lunch
    await expect(group.getByRole("checkbox").first()).toBeChecked();
    await group.getByRole("checkbox", { checked: true }).nth(4).uncheck();
    await group.getByRole("button", { name: "Add leftovers" }).click();

    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({
        path: "/api/meal-plan/1/leftovers",
        body: {
          slots: [
            { plannedDate: "2026-11-18", mealType: "lunch" },
            { plannedDate: "2026-11-18", mealType: "dinner" },
            { plannedDate: "2026-11-19", mealType: "lunch" },
            { plannedDate: "2026-11-19", mealType: "dinner" },
          ],
        },
      });
    const wedLunch = slot(page, /Wed, Nov 18/, "lunch");
    await expect(wedLunch.getByText("Imported Soup")).toBeVisible();
    await expect(wedLunch.getByTitle("Leftovers")).toBeVisible();
    await expect(card.getByText("+4", { exact: true })).toBeVisible();
    // leftover cards have no options or multiplier of their own
    await expect(
      wedLunch.getByRole("button", { name: /Options for/ }),
    ).toHaveCount(0);
  });

  test("eating a leftover is not a cook; removing a meal warns about its leftovers", async ({
    page,
  }) => {
    const api = await installPlannerApi(page, {
      visibleSlots: ["lunch", "dinner"],
      seed: [
        mealEntry({ id: 1, plannedDate: "2026-11-17", mealType: "dinner", leftoverCount: 1 }),
        mealEntry({
          id: 2,
          plannedDate: "2026-11-18",
          mealType: "lunch",
          kind: "leftover",
          sourceEntryId: 1,
        }),
      ],
    });
    await openPlanner(page);

    await slot(page, /Wed, Nov 18/, "lunch")
      .getByRole("checkbox", { name: /Mark leftover Imported Soup as eaten/ })
      .check();
    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({ path: "/api/meal-plan/2/cooked", body: { cooked: true } });
    // no "now a favorite" celebration: leftovers never count as cooking
    await expect(page.getByText(/now a favorite/)).toHaveCount(0);

    await slot(page, /Tue, Nov 17/, "dinner")
      .getByRole("button", { name: /^Remove Imported Soup/ })
      .click();
    await expect(page.getByText(/Removed Imported Soup and its 1 leftover/)).toBeVisible();
    await expect(slot(page, /Wed, Nov 18/, "lunch").getByText("Imported Soup")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(slot(page, /Wed, Nov 18/, "lunch").getByText("Imported Soup")).toBeVisible();
    expect(api.calls.filter((c) => c.method === "DELETE")).toHaveLength(0);
  });

  test("dragging a meal carries its leftovers along", async ({ page }) => {
    const api = await installPlannerApi(page, {
      visibleSlots: ["dinner"],
      seed: [
        mealEntry({ id: 1, plannedDate: "2026-11-17", mealType: "dinner", leftoverCount: 1 }),
        mealEntry({
          id: 2,
          plannedDate: "2026-11-18",
          mealType: "dinner",
          kind: "leftover",
          sourceEntryId: 1,
        }),
      ],
    });
    await openPlanner(page);
    await mouseDrag(
      page,
      slot(page, /Tue, Nov 17/, "dinner").getByRole("button", { name: /^Drag Imported Soup/ }),
      slot(page, /Thu, Nov 19/, "dinner"),
    );
    await expect(
      slot(page, /Thu, Nov 19/, "dinner").getByText("Imported Soup"),
    ).toBeVisible();
    // the leftover keeps its one day offset: Wednesday -> Friday
    await expect(
      slot(page, /Fri, Nov 20/, "dinner").getByTitle("Leftovers"),
    ).toBeVisible();
    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({ method: "PATCH", path: "/api/meal-plan/1", body: { plannedDate: "2026-11-19" } });
  });

  test("adds a meal's ingredients to the grocery list at its multiplier", async ({
    page,
  }) => {
    const api = await installPlannerApi(page, {
      visibleSlots: ["dinner"],
      seed: [mealEntry({ id: 1, plannedDate: "2026-11-17", multiplier: 2 })],
    });
    await openPlanner(page);
    const card = slot(page, /Tue, Nov 17/, "dinner");
    await card.getByRole("button", { name: /Options for Imported Soup/ }).click();
    await card.getByRole("button", { name: /Add ingredients to grocery list/ }).click();
    await expect
      .poll(() => api.calls.at(-1))
      .toMatchObject({
        path: "/api/recipes/7/add-to-grocery-list",
        body: { scale: 2 },
      });
    await expect(page.getByText(/Added 5 ingredients \(×2\)/)).toBeVisible();
    await expect(page.getByText(/Skipped 1 staple you have in stock/)).toBeVisible();
  });
});

test.describe("meal planner on touch", () => {
  test.use({ hasTouch: true, viewport: { width: 1280, height: 900 } });

  test("a press-and-drag with a finger drops a recipe on a slot", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "touch is driven through CDP");
    await page.clock.setFixedTime(NOW);
    const api = await installPlannerApi(page);
    await openPlanner(page);

    const from = (await page
      .locator(".planner-recipe", { hasText: "Structured Soup" })
      .boundingBox())!;
    const to = (await slot(page, /Tue, Nov 17/, "dinner").boundingBox())!;
    const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    const end = { x: to.x + to.width / 2, y: to.y + to.height / 2 };

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [start],
    });
    await page.waitForTimeout(350); // hold past the activation delay
    for (let step = 1; step <= 12; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: start.x + ((end.x - start.x) * step) / 12,
            y: start.y + ((end.y - start.y) * step) / 12,
          },
        ],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await expect(
      slot(page, /Tue, Nov 17/, "dinner").getByText("Structured Soup"),
    ).toBeVisible();
    expect(api.calls.at(-1)?.body).toMatchObject({
      recipeId: 8,
      plannedDate: "2026-11-17",
      mealType: "dinner",
    });
  });
});
