import request from "supertest";
import { app } from "../../../05_frameworks/index";
import db from "../../../05_frameworks/database/connection";
import { generateAccessToken } from "../../../utils/jwt";

jest.mock("../../../utils/safeUrlFetch", () => ({
  ...jest.requireActual("../../../utils/safeUrlFetch"),
  fetchPublicHtml: jest.fn(async () => {
    const recipe = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "E2E Chicken & Rice",
      image: ["https://example.com/a.jpg"],
      recipeYield: "4 servings",
      prepTime: "PT15M",
      recipeIngredient: ["1 cup rice", "2 chicken breasts"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Cook it" }],
    };
    return `<html><script type="application/ld+json">${JSON.stringify(recipe)}</script></html>`;
  }),
}));

// Keep text parsing deterministic and free: Gemini is always unavailable.
jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn(() => ({
    getGenerativeModel: () => ({
      generateContent: async () => {
        throw new Error("402 Payment Required");
      },
    }),
  })),
}));

describe("recipe import end to end", () => {
  const email = `import-e2e-${Date.now()}@example.com`;
  let userId: number;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const user = await db.query(
      "INSERT INTO users (email, display_name) VALUES ($1, 'Import E2E') RETURNING id",
      [email],
    );
    userId = user.rows[0].id;
    token = generateAccessToken(userId, email, "Import E2E");
  });

  afterAll(async () => {
    await db.query("DELETE FROM users WHERE id = $1", [userId]);
  });

  async function importAndSave() {
    const imported = await request(app)
      .post("/api/recipes/import-url")
      .set(auth())
      .send({ url: "https://example.com/recipe" });
    expect(imported.status).toBe(200);

    const saved = await request(app)
      .post("/api/recipes")
      .set(auth())
      .send({
        ...imported.body.parsed,
        images: imported.body.imageUrls.map((imageUrl: string, i: number) => ({
          imageUrl,
          isPrimary: i === 0,
        })),
      });
    return saved;
  }

  it("imports a URL, saves it with images and structured ingredients, and tolerates re-import", async () => {
    const first = await importAndSave();
    expect(first.status).toBe(200);
    const second = await importAndSave();
    expect(second.status).toBe(200);
    expect(second.body.slug).not.toBe(first.body.slug);

    const ingredients = await db.query(
      "SELECT ingredients FROM recipe_ingredients WHERE recipe_id = $1",
      [first.body.id],
    );
    expect(ingredients.rows[0].ingredients).toEqual([
      { id: 1, name: "rice", quantity: 1, unit: "cup" },
      { id: 2, name: "chicken breasts", quantity: 2, unit: "" },
    ]);
    const images = await db.query(
      "SELECT image_url, is_primary FROM recipe_images WHERE recipe_id = $1",
      [first.body.id],
    );
    expect(images.rows).toEqual([
      { image_url: "https://example.com/a.jpg", is_primary: true },
    ]);

    const fetched = await request(app)
      .get(`/api/recipes/${first.body.id}`)
      .set(auth());
    expect(fetched.status).toBe(200);
    expect(fetched.body.name).toBe("E2E Chicken & Rice");
  });

  it("parses pasted text into a structured recipe without AI, and it saves", async () => {
    const parsedRes = await request(app)
      .post("/api/ocr/parse")
      .set(auth())
      .send({
        text: "Simple Pancakes\nServes 4\nIngredients\n1 1/2 cups flour\n1 egg\nInstructions\n1. Mix.\n2. Fry.",
      });
    expect(parsedRes.status).toBe(200);
    const { parsed } = parsedRes.body;
    expect(parsed.name).toBe("Simple Pancakes");
    expect(parsed.instructions).toHaveLength(2);
    expect(parsed.ingredients.default).toHaveLength(2);

    const saved = await request(app).post("/api/recipes").set(auth()).send(parsed);
    expect(saved.status).toBe(200);
  });
});
