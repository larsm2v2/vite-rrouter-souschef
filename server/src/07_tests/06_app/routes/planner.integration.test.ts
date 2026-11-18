import request from "supertest";
import { app } from "../../../05_frameworks/index";
import db from "../../../05_frameworks/database/connection";
import { generateAccessToken } from "../../../utils/jwt";

describe("meal planner, cooking history and staples", () => {
  const stamp = Date.now();
  const emails = [`planner-a-${stamp}@example.com`, `planner-b-${stamp}@example.com`];
  let userA: number;
  let userB: number;
  let tokenA: string;
  let tokenB: string;
  let recipeA: number;
  let recipeB: number;
  let recipeC: number;

  // The API limiter allows 100 requests per IP; blocks that need more simulate another client.
  let clientIp = "10.0.0.1";
  const as = (token: string) => ({
    Authorization: `Bearer ${token}`,
    "X-Forwarded-For": clientIp,
  });
  const a = () => as(tokenA);

  async function makeRecipe(
    userId: number,
    name: string,
    ingredients: string[] = [],
  ): Promise<number> {
    const uniqueId = stamp * 1000 + Math.floor(Math.random() * 1000);
    const created = await db.query(
      `INSERT INTO recipes (user_id, unique_id, name, slug)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, uniqueId, name, `${name}-${uniqueId}`.toLowerCase().replace(/\s+/g, "-")],
    );
    const id = created.rows[0].id;
    if (ingredients.length) {
      await db.query(
        "INSERT INTO recipe_ingredients (recipe_id, category, ingredients) VALUES ($1, 'default', $2)",
        [id, JSON.stringify(ingredients)],
      );
    }
    return id;
  }

  beforeAll(async () => {
    const users = await Promise.all(
      emails.map((email, i) =>
        db.query(
          "INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id",
          [email, `Planner ${i}`],
        ),
      ),
    );
    userA = users[0].rows[0].id;
    userB = users[1].rows[0].id;
    tokenA = generateAccessToken(userA, emails[0], "Planner 0");
    tokenB = generateAccessToken(userB, emails[1], "Planner 1");
    recipeA = await makeRecipe(userA, "Planner Pasta", [
      "1 tsp kosher salt",
      "2 cups flour",
      "1 tsp black pepper",
    ]);
    recipeC = await makeRecipe(userA, "Planner Soup");
    recipeB = await makeRecipe(userB, "Other Users Stew");
  });

  afterAll(async () => {
    await db.query("DELETE FROM users WHERE id = ANY($1)", [[userA, userB]]);
  });

  describe("meal plan CRUD", () => {
    let entryId: number;

    it("validates input and refuses other users' recipes", async () => {
      const bad = [
        { recipeId: recipeA, plannedDate: "2026-02-30" },
        { recipeId: recipeA, plannedDate: "2026-11-16", mealType: "brunch" },
        { recipeId: "abc", plannedDate: "2026-11-16" },
      ];
      for (const body of bad) {
        const res = await request(app).post("/api/meal-plan").set(a()).send(body);
        expect(res.status).toBe(400);
      }
      const foreign = await request(app)
        .post("/api/meal-plan")
        .set(a())
        .send({ recipeId: recipeB, plannedDate: "2026-11-16" });
      expect(foreign.status).toBe(404);
    });

    it("adds, lists a range, moves and deletes entries", async () => {
      const created = await request(app)
        .post("/api/meal-plan")
        .set(a())
        .send({ recipeId: recipeA, plannedDate: "2026-11-16", mealType: "dinner" });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        recipeName: "Planner Pasta",
        plannedDate: "2026-11-16",
        mealType: "dinner",
        isCooked: false,
      });
      entryId = created.body.id;

      const inRange = await request(app)
        .get("/api/meal-plan?start=2026-11-16&end=2026-11-22")
        .set(a());
      expect(inRange.body.map((e: any) => e.id)).toContain(entryId);
      const outOfRange = await request(app)
        .get("/api/meal-plan?start=2026-11-23&end=2026-11-29")
        .set(a());
      expect(outOfRange.body).toEqual([]);

      const moved = await request(app)
        .patch(`/api/meal-plan/${entryId}`)
        .set(a())
        .send({ plannedDate: "2026-11-18", mealType: "lunch" });
      expect(moved.status).toBe(200);
      expect(moved.body).toMatchObject({ plannedDate: "2026-11-18", mealType: "lunch" });
    });

    it("keeps other users from reading, moving or deleting entries", async () => {
      const otherList = await request(app)
        .get("/api/meal-plan?start=2026-11-16&end=2026-11-22")
        .set(as(tokenB));
      expect(otherList.body).toEqual([]);
      const move = await request(app)
        .patch(`/api/meal-plan/${entryId}`)
        .set(as(tokenB))
        .send({ mealType: "snack" });
      expect(move.status).toBe(404);
      const del = await request(app)
        .delete(`/api/meal-plan/${entryId}`)
        .set(as(tokenB));
      expect(del.status).toBe(404);
    });

    it("rejects oversized or malformed ranges", async () => {
      const huge = await request(app)
        .get("/api/meal-plan?start=2020-01-01&end=2026-01-01")
        .set(a());
      expect(huge.status).toBe(400);
      const bad = await request(app).get("/api/meal-plan?start=nope&end=nope").set(a());
      expect(bad.status).toBe(400);
    });

    it("deletes an entry", async () => {
      const del = await request(app).delete(`/api/meal-plan/${entryId}`).set(a());
      expect(del.status).toBe(200);
    });
  });

  describe("history", () => {
    it("groups past weeks by the configured week start and can copy a week forward", async () => {
      for (const [date, recipeId] of [
        ["2026-11-02", recipeA], // week of Mon 2026-11-02
        ["2026-11-08", recipeC], // Sunday: still that Mon-Sun week
        ["2026-11-10", recipeC], // next week
        ["2026-11-24", recipeA], // current week (excluded)
      ] as const) {
        const res = await request(app)
          .post("/api/meal-plan")
          .set(a())
          .send({ recipeId, plannedDate: date });
        expect(res.status).toBe(201);
      }

      const history = await request(app)
        .get("/api/meal-plan/history?today=2026-11-24")
        .set(a());
      expect(history.status).toBe(200);
      expect(history.body.map((w: any) => w.weekStart)).toEqual([
        "2026-11-09",
        "2026-11-02",
      ]);
      expect(history.body[1].entries.map((e: any) => e.plannedDate)).toEqual([
        "2026-11-02",
        "2026-11-08",
      ]);

      const limited = await request(app)
        .get("/api/meal-plan/history?today=2026-11-24&weeks=1")
        .set(a());
      expect(limited.body).toHaveLength(1);

      const copied = await request(app)
        .post("/api/meal-plan/copy-week")
        .set(a())
        .send({ fromStart: "2026-11-02", toStart: "2026-12-07" });
      expect(copied.status).toBe(201);
      expect(copied.body.map((e: any) => e.plannedDate).sort()).toEqual([
        "2026-12-07",
        "2026-12-13",
      ]);

      // Sunday-start weeks regroup the same rows
      await request(app).put("/api/planner/settings").set(a()).send({ weekStartDay: 0 });
      const sundayHistory = await request(app)
        .get("/api/meal-plan/history?today=2026-11-24")
        .set(a());
      expect(sundayHistory.body.map((w: any) => w.weekStart)).toContain("2026-11-08");
      await request(app).put("/api/planner/settings").set(a()).send({ weekStartDay: 1 });
    });

    it("keeps history after the recipe is deleted", async () => {
      const temp = await makeRecipe(userA, "Short Lived Dish");
      const entry = await request(app)
        .post("/api/meal-plan")
        .set(a())
        .send({ recipeId: temp, plannedDate: "2026-10-05" });
      await db.query("DELETE FROM recipes WHERE id = $1", [temp]);

      const history = await request(app)
        .get("/api/meal-plan/history?today=2026-11-24&weeks=52")
        .set(a());
      const kept = history.body
        .flatMap((w: any) => w.entries)
        .find((e: any) => e.id === entry.body.id);
      expect(kept).toMatchObject({ recipeName: "Short Lived Dish", recipeId: null });
    });
  });

  describe("completions and auto-favorites", () => {
    const stats = async (id: number) =>
      (
        await db.query(
          "SELECT cook_count, is_favorite, favorite_locked FROM recipes WHERE id = $1",
          [id],
        )
      ).rows[0];

    it("validates settings", async () => {
      for (const body of [
        { weekStartDay: 7 },
        { favoriteThreshold: -1 },
        { favoriteThreshold: 1.5 },
        { visibleSlots: [] },
        { visibleSlots: ["brunch"] },
        { householdSize: 0 },
        { householdSize: 21 },
      ]) {
        const res = await request(app).put("/api/planner/settings").set(a()).send(body);
        expect(res.status).toBe(400);
      }
      const defaults = await request(app).get("/api/planner/settings").set(a());
      expect(defaults.body).toEqual({
        weekStartDay: 1,
        favoriteThreshold: 3,
        visibleSlots: ["dinner"],
        householdSize: 2,
      });
    });

    it("counts a recipe once per day and auto-favorites at the threshold", async () => {
      await request(app).put("/api/planner/settings").set(a()).send({ favoriteThreshold: 3 });

      const first = await request(app)
        .post(`/api/recipes/${recipeC}/complete`)
        .set(a())
        .send({ cookedOn: "2026-09-01" });
      expect(first.body).toMatchObject({ recorded: true, cookCount: 1, isFavorite: false });
      const sameDay = await request(app)
        .post(`/api/recipes/${recipeC}/complete`)
        .set(a())
        .send({ cookedOn: "2026-09-01" });
      expect(sameDay.body).toMatchObject({ recorded: false, cookCount: 1 });

      await request(app).post(`/api/recipes/${recipeC}/complete`).set(a()).send({ cookedOn: "2026-09-02" });
      const third = await request(app)
        .post(`/api/recipes/${recipeC}/complete`)
        .set(a())
        .send({ cookedOn: "2026-09-03" });
      expect(third.body).toMatchObject({ cookCount: 3, isFavorite: true, autoFavorited: true });

      const listed = await request(app).get("/api/recipes").set(a());
      const row = listed.body.find((r: any) => r.id === String(recipeC));
      expect(row).toMatchObject({ is_favorite: true, cook_count: 3, last_cooked_on: "2026-09-03" });
    });

    it("lets a manual unfavorite stick against further completions", async () => {
      const toggled = await request(app).patch(`/api/recipes/${recipeC}/favorite`).set(a());
      expect(toggled.body.isFavorite).toBe(false);
      expect((await stats(recipeC)).favorite_locked).toBe(true);

      const again = await request(app)
        .post(`/api/recipes/${recipeC}/complete`)
        .set(a())
        .send({ cookedOn: "2026-09-04" });
      expect(again.body).toMatchObject({ cookCount: 4, isFavorite: false, autoFavorited: false });

      // favoriting manually clears the lock
      await request(app).patch(`/api/recipes/${recipeC}/favorite`).set(a());
      expect((await stats(recipeC)).favorite_locked).toBe(false);
    });

    it("records a completion when a planned meal is checked off and undoes it", async () => {
      const entry = await request(app)
        .post("/api/meal-plan")
        .set(a())
        .send({ recipeId: recipeA, plannedDate: "2026-08-10" });
      const id = entry.body.id;

      const checked = await request(app).post(`/api/meal-plan/${id}/cooked`).set(a()).send({});
      expect(checked.status).toBe(200);
      expect(checked.body.entry.isCooked).toBe(true);
      expect(checked.body.completion).toMatchObject({ recorded: true, cookCount: 1 });
      expect((await stats(recipeA)).cook_count).toBe(1);

      const unchecked = await request(app)
        .post(`/api/meal-plan/${id}/cooked`)
        .set(a())
        .send({ cooked: false });
      expect(unchecked.body.entry.isCooked).toBe(false);
      expect((await stats(recipeA)).cook_count).toBe(0);
    });

    it("does not let un-checking a plan entry erase a Cook Mode completion", async () => {
      await request(app).post(`/api/recipes/${recipeA}/complete`).set(a()).send({ cookedOn: "2026-08-11" });
      const entry = await request(app)
        .post("/api/meal-plan")
        .set(a())
        .send({ recipeId: recipeA, plannedDate: "2026-08-11" });
      await request(app).post(`/api/meal-plan/${entry.body.id}/cooked`).set(a()).send({});
      await request(app).post(`/api/meal-plan/${entry.body.id}/cooked`).set(a()).send({ cooked: false });
      expect((await stats(recipeA)).cook_count).toBe(1);
    });

    it("refuses to complete another user's recipe", async () => {
      const res = await request(app).post(`/api/recipes/${recipeB}/complete`).set(a()).send({});
      expect(res.status).toBe(404);
    });

    it("retroactively favorites qualifying recipes when the threshold is lowered", async () => {
      await db.query("UPDATE recipes SET is_favorite = false, favorite_locked = false WHERE id = $1", [recipeC]);
      await request(app).put("/api/planner/settings").set(a()).send({ favoriteThreshold: 2 });
      expect((await stats(recipeC)).is_favorite).toBe(true);
    });
  });

  describe("staples", () => {
    it("loads and saves staples for an authenticated user", async () => {
      const empty = await request(app).get("/api/already-stocked").set(a());
      expect(empty.status).toBe(200);

      const saved = await request(app)
        .post("/api/already-stocked")
        .set(a())
        .send({ stockedItems: [{ name: " Salt ", category: "Spices" }, { name: "salt" }, { name: "Black Pepper" }] });
      expect(saved.status).toBe(200);
      expect(saved.body.stockedItems).toEqual([
        { name: "Salt", category: "Spices" },
        { name: "Black Pepper" },
      ]);

      const bad = await request(app).post("/api/already-stocked").set(a()).send({ stockedItems: [{ x: 1 }] });
      expect(bad.status).toBe(400);
    });

    it("adds a single staple without replacing the rest, and offers starters", async () => {
      const added = await request(app)
        .post("/api/already-stocked/items")
        .set(a())
        .send({ name: "olive oil", category: "Oils" });
      expect(added.body.stockedItems.map((i: any) => i.name)).toEqual(["Salt", "Black Pepper", "olive oil"]);

      const suggestions = await request(app).get("/api/already-stocked/suggestions").set(a());
      expect(suggestions.body.categories.Spices).toContain("salt");
    });

    it("skips in-stock staples when adding a recipe to the grocery list", async () => {
      const added = await request(app)
        .post(`/api/recipes/${recipeA}/add-to-grocery-list`)
        .set(a())
        .send({});
      expect(added.status).toBe(200);
      expect(added.body.itemsAdded).toBe(1);
      expect(added.body.skippedStaples.sort()).toEqual(["black pepper", "kosher salt"]);

      const list = await request(app).get("/api/grocery-list/version").set(a());
      const names = JSON.stringify(list.body);
      expect(names).toContain("flour");
      expect(names).not.toContain("kosher salt");
    });

    it("includes staples marked running low or when explicitly asked", async () => {
      await request(app)
        .post("/api/already-stocked")
        .set(a())
        .send({ stockedItems: [{ name: "Salt", runningLow: true }, { name: "Black Pepper" }] });
      const low = await request(app).post(`/api/recipes/${recipeA}/add-to-grocery-list`).set(a()).send({});
      expect(low.body.skippedStaples).toEqual(["black pepper"]);

      const all = await request(app)
        .post(`/api/recipes/${recipeA}/add-to-grocery-list`)
        .set(a())
        .send({ includeStaples: true });
      expect(all.body.skippedStaples).toEqual([]);
    });
  });

  describe("visible slots and household size", () => {
    it("stores visible slots in day order and the household size", async () => {
      const saved = await request(app)
        .put("/api/planner/settings")
        .set(a())
        .send({ visibleSlots: ["dinner", "breakfast"], householdSize: 4 });
      expect(saved.status).toBe(200);
      expect(saved.body).toMatchObject({
        visibleSlots: ["breakfast", "dinner"],
        householdSize: 4,
      });
      await request(app)
        .put("/api/planner/settings")
        .set(a())
        .send({ visibleSlots: ["dinner"], householdSize: 2 });
    });
  });

  describe("multiplier and leftovers", () => {
    beforeAll(() => {
      clientIp = "10.0.0.2";
    });
    const meal = async (date: string, slot = "dinner", recipeId = recipeA) =>
      (
        await request(app)
          .post("/api/meal-plan")
          .set(a())
          .send({ recipeId, plannedDate: date, mealType: slot })
      ).body;
    const leftovers = (id: number, slots: unknown, token = tokenA) =>
      request(app).post(`/api/meal-plan/${id}/leftovers`).set(as(token)).send({ slots });
    const range = async (start: string, end: string) =>
      (await request(app).get(`/api/meal-plan?start=${start}&end=${end}`).set(a())).body;

    it("validates and stores the recipe multiplier", async () => {
      const created = await request(app)
        .post("/api/meal-plan")
        .set(a())
        .send({ recipeId: recipeA, plannedDate: "2027-02-01", multiplier: 2.5 });
      expect(created.body.multiplier).toBe(2.5);

      for (const multiplier of [0.5, 1.2, 4.5, "2"]) {
        const bad = await request(app)
          .patch(`/api/meal-plan/${created.body.id}`)
          .set(a())
          .send({ multiplier });
        expect(bad.status).toBe(400);
      }
      const ok = await request(app)
        .patch(`/api/meal-plan/${created.body.id}`)
        .set(a())
        .send({ multiplier: 4 });
      expect(ok.body.multiplier).toBe(4);
    });

    it("creates linked leftover cards after the meal and reports the count on the meal", async () => {
      const source = await meal("2027-03-02");
      const res = await leftovers(source.id, [
        { plannedDate: "2027-03-03", mealType: "lunch" },
        { plannedDate: "2027-03-04", mealType: "dinner" },
      ]);
      expect(res.status).toBe(201);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({
        kind: "leftover",
        sourceEntryId: source.id,
        recipeName: "Planner Pasta",
        multiplier: 1,
      });
      const week = await range("2027-03-01", "2027-03-07");
      expect(week.find((e: any) => e.id === source.id)).toMatchObject({
        kind: "meal",
        leftoverCount: 2,
      });
    });

    it("rejects leftovers that are not after the meal, malformed requests and strangers", async () => {
      const source = await meal("2027-04-06");
      for (const slots of [
        [{ plannedDate: "2027-04-05", mealType: "dinner" }],
        [{ plannedDate: "2027-04-06", mealType: "dinner" }],
        [{ plannedDate: "2027-04-06", mealType: "lunch" }],
      ]) {
        expect((await leftovers(source.id, slots)).status).toBe(409);
      }
      // a later slot the same day is fine
      expect(
        (await leftovers(source.id, [{ plannedDate: "2027-04-06", mealType: "snack" }])).status,
      ).toBe(201);
      expect((await leftovers(source.id, [])).status).toBe(400);
      expect((await leftovers(source.id, [{ plannedDate: "nope", mealType: "lunch" }])).status).toBe(400);
      expect(
        (await leftovers(source.id, Array(11).fill({ plannedDate: "2027-04-09", mealType: "lunch" }))).status,
      ).toBe(400);
      expect(
        (await leftovers(source.id, [{ plannedDate: "2027-04-09", mealType: "lunch" }], tokenB)).status,
      ).toBe(404);
      // nothing from the rejected requests was saved
      const week = await range("2027-04-05", "2027-04-11");
      expect(week.filter((e: any) => e.kind === "leftover")).toHaveLength(1);
    });

    it("does not allow leftovers of leftovers, or a multiplier on a leftover", async () => {
      const source = await meal("2027-05-04");
      const [left] = (await leftovers(source.id, [{ plannedDate: "2027-05-05", mealType: "dinner" }])).body;
      expect((await leftovers(left.id, [{ plannedDate: "2027-05-06", mealType: "dinner" }])).status).toBe(404);
      const scaled = await request(app).patch(`/api/meal-plan/${left.id}`).set(a()).send({ multiplier: 2 });
      expect(scaled.status).toBe(409);
    });

    it("moving a meal carries its leftovers; a leftover cannot move before its meal", async () => {
      const source = await meal("2027-06-01");
      const [left] = (await leftovers(source.id, [{ plannedDate: "2027-06-02", mealType: "dinner" }])).body;

      const early = await request(app)
        .patch(`/api/meal-plan/${left.id}`)
        .set(a())
        .send({ plannedDate: "2027-05-31" });
      expect(early.status).toBe(409);
      const later = await request(app)
        .patch(`/api/meal-plan/${left.id}`)
        .set(a())
        .send({ plannedDate: "2027-06-04" });
      expect(later.status).toBe(200);

      await request(app).patch(`/api/meal-plan/${source.id}`).set(a()).send({ plannedDate: "2027-06-08" });
      const week = await range("2027-06-08", "2027-06-14");
      const moved = week.find((e: any) => e.id === left.id);
      expect(moved.plannedDate).toBe("2027-06-11"); // kept its 3 day offset
    });

    it("eating leftovers does not count as cooking; the meal itself does", async () => {
      const recipe = await makeRecipe(userA, "Leftover Counter");
      const source = await meal("2027-07-01", "dinner", recipe);
      const [left] = (await leftovers(source.id, [{ plannedDate: "2027-07-02", mealType: "lunch" }])).body;

      const eaten = await request(app).post(`/api/meal-plan/${left.id}/cooked`).set(a()).send({});
      expect(eaten.body.entry.isCooked).toBe(true);
      expect(eaten.body.completion).toBeNull();
      const none = await db.query("SELECT cook_count FROM recipes WHERE id = $1", [recipe]);
      expect(none.rows[0].cook_count).toBe(0);

      await request(app).post(`/api/meal-plan/${source.id}/cooked`).set(a()).send({});
      const one = await db.query("SELECT cook_count FROM recipes WHERE id = $1", [recipe]);
      expect(one.rows[0].cook_count).toBe(1);
    });

    it("removes leftovers together with their meal", async () => {
      const source = await meal("2027-08-03");
      const [left] = (await leftovers(source.id, [{ plannedDate: "2027-08-04", mealType: "dinner" }])).body;
      await request(app).delete(`/api/meal-plan/${source.id}`).set(a());
      const week = await range("2027-08-01", "2027-08-07");
      expect(week.find((e: any) => e.id === left.id)).toBeUndefined();

      // deleting just a leftover leaves the meal alone
      const keep = await meal("2027-08-10");
      const [other] = (await leftovers(keep.id, [{ plannedDate: "2027-08-11", mealType: "dinner" }])).body;
      await request(app).delete(`/api/meal-plan/${other.id}`).set(a());
      const after = await range("2027-08-08", "2027-08-14");
      expect(after.find((e: any) => e.id === keep.id)).toMatchObject({ leftoverCount: 0 });
    });

    it("copies a week with multipliers and leftovers, including ones that spill into the next week", async () => {
      // Mon 2027-09-06 .. Sun 2027-09-12; the leftover lands on Mon 2027-09-13
      const source = await request(app)
        .post("/api/meal-plan")
        .set(a())
        .send({ recipeId: recipeA, plannedDate: "2027-09-12", mealType: "dinner", multiplier: 3 });
      await leftovers(source.body.id, [{ plannedDate: "2027-09-13", mealType: "lunch" }]);

      const copied = await request(app)
        .post("/api/meal-plan/copy-week")
        .set(a())
        .send({ fromStart: "2027-09-06", toStart: "2027-09-20" });
      expect(copied.status).toBe(201);
      const meal2 = copied.body.find((e: any) => e.kind === "meal");
      const left2 = copied.body.find((e: any) => e.kind === "leftover");
      expect(meal2).toMatchObject({ plannedDate: "2027-09-26", multiplier: 3 });
      expect(left2).toMatchObject({ plannedDate: "2027-09-27", sourceEntryId: meal2.id });
    });
  });
});
