import { test, expect, Page } from "@playwright/test";

const USER = {
  id: "sync-test",
  email: "sync@example.com",
  display_name: "Sync Test",
};

interface Item {
  name: string;
  quantity: number;
  unit: string;
  checked: boolean;
}

interface Server {
  version: number;
  list: Item[] | null;
  failGet: boolean;
  posts: { listData: Item[]; baseVersion?: number }[];
}

async function prepare(page: Page, server: Server) {
  await page.addInitScript((u) => {
    localStorage.setItem("user", JSON.stringify(u));
    localStorage.setItem("selectedRecipeIds", "[]");
  }, USER);
  await page.route(
    (url) => url.pathname.includes("/api/") || url.pathname.includes("/auth/"),
    (route) => {
      const type = route.request().resourceType();
      if (type !== "xhr" && type !== "fetch") return route.continue();
      const path = new URL(route.request().url()).pathname;
      const json = (status: number, body: unknown) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (path.includes("/auth/"))
        return json(200, { authenticated: true, accessToken: "t" });
      if (path.endsWith("/api/grocery-list/version")) {
        if (route.request().method() === "GET") {
          if (server.failGet) return json(500, { error: "boom" });
          return json(
            200,
            server.list === null
              ? null
              : { version: server.version, listData: server.list },
          );
        }
        const body = route.request().postDataJSON() as {
          listData: Item[];
          baseVersion?: number;
        };
        server.posts.push(body);
        if (
          body.baseVersion !== undefined &&
          body.baseVersion !== server.version
        ) {
          return json(409, {
            error: "changed",
            current: { version: server.version, listData: server.list },
          });
        }
        server.version += 1;
        server.list = body.listData;
        return json(201, { version: server.version, listData: server.list });
      }
      return json(200, []);
    },
  );
}

const apples: Item = { name: "apples", quantity: 3, unit: "", checked: false };

async function addItem(page: Page, name: string) {
  const sidebar = page.locator("#App-sidebar");
  await sidebar.getByLabel("Quantity").fill("1");
  await sidebar.getByLabel("Grocery item").fill(name);
  await sidebar
    .getByRole("button", { name: "Go", exact: true })
    .first()
    .click();
}

const open = (page: Page) =>
  page.locator('[data-action="toggle-grocery"]:visible').click();

test.describe("grocery list sync", () => {
  test("saves send the loaded version and follow the server's new version", async ({
    page,
  }) => {
    const server: Server = {
      version: 5,
      list: [apples],
      failGet: false,
      posts: [],
    };
    await prepare(page, server);
    await page.goto("/sous-chef");
    await open(page);
    await addItem(page, "pears");
    await expect.poll(() => server.posts.length).toBe(1);
    expect(server.posts[0].baseVersion).toBe(5);

    await addItem(page, "figs");
    await expect.poll(() => server.posts.length).toBe(2);
    expect(server.posts[1].baseVersion).toBe(6);
    expect(server.posts[1].listData.map((i) => i.name)).toEqual([
      "apples",
      "pears",
      "figs",
    ]);
  });

  test("a conflict adopts the server's list instead of overwriting it, and says so", async ({
    page,
  }) => {
    const server: Server = {
      version: 5,
      list: [apples],
      failGet: false,
      posts: [],
    };
    await prepare(page, server);
    await page.goto("/sous-chef");
    await open(page);
    await expect(
      page.locator("#App-sidebar").getByText("3 apples"),
    ).toBeVisible();

    // Another tab, or a recipe added elsewhere, saves first.
    server.version = 9;
    server.list = [
      apples,
      { name: "leeks", quantity: 2, unit: "", checked: false },
    ];

    await addItem(page, "pears");
    await expect(page.getByText(/updated elsewhere/)).toBeVisible();
    const sidebar = page.locator("#App-sidebar");
    await expect(sidebar.getByText("2 leeks")).toBeVisible();
    await expect(sidebar.getByText("1 pears")).toHaveCount(0);
    expect(server.list.map((i) => i.name)).toEqual(["apples", "leeks"]);

    // The next edit is based on the adopted version and goes through.
    await addItem(page, "figs");
    await expect.poll(() => server.version).toBe(10);
    expect(server.posts.at(-1)!.baseVersion).toBe(9);
  });

  test("a user with no saved list yet starts empty and the first save is based on version 0", async ({
    page,
  }) => {
    const server: Server = {
      version: 0,
      list: null,
      failGet: false,
      posts: [],
    };
    await prepare(page, server);
    await page.goto("/sous-chef");
    await open(page);
    await addItem(page, "rice");
    await expect.poll(() => server.posts.length).toBe(1);
    expect(server.posts[0].baseVersion).toBe(0);
  });

  test("if the list could not be loaded, nothing is saved over it", async ({
    page,
  }) => {
    const server: Server = {
      version: 5,
      list: [apples],
      failGet: true,
      posts: [],
    };
    await prepare(page, server);
    await page.goto("/sous-chef");
    await expect(
      page.getByText(/Could not load your grocery list/),
    ).toBeVisible();
    await open(page);
    await addItem(page, "pears");
    await page.waitForTimeout(1500);
    expect(server.posts).toHaveLength(0);
  });

  test("loading and idling never creates a version", async ({ page }) => {
    const server: Server = {
      version: 5,
      list: [apples],
      failGet: false,
      posts: [],
    };
    await prepare(page, server);
    await page.goto("/sous-chef");
    await page.waitForTimeout(2000);
    expect(server.posts).toHaveLength(0);
  });
});
