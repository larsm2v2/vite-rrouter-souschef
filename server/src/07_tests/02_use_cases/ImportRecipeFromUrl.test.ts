jest.mock("../../utils/safeUrlFetch", () => ({
  fetchPublicHtml: jest.fn(),
}));

import { ImportRecipeFromUrl } from "../../02_use_cases/ImportRecipeFromUrl";
import { fetchPublicHtml } from "../../utils/safeUrlFetch";

const mockedFetchPublicHtml = jest.mocked(fetchPublicHtml);

describe("ImportRecipeFromUrl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes schema.org JSON-LD into an editable recipe", async () => {
    mockedFetchPublicHtml.mockResolvedValue(`
      <html><head><script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Lemon toast",
        "recipeCuisine": ["Mediterranean"],
        "recipeCategory": "Lunch",
        "recipeYield": "4 servings",
        "prepTime": "PT10M",
        "recipeIngredient": ["2 lemons", "4 slices bread"],
        "recipeInstructions": [
          { "@type": "HowToStep", "text": "Toast the bread." },
          {
            "@type": "https://schema.org/HowToSection",
            "itemListElement": [{ "@type": "HowToStep", "text": "Add lemon." }]
          }
        ],
        "image": ["/lemon-toast.jpg", { "url": "https://images.example.org/lemon.jpg" }, "javascript:alert(1)"]
      }
      </script></head></html>
    `);

    const imported = await new ImportRecipeFromUrl().execute(
      "https://recipes.example.org/lemon-toast",
    );

    expect(imported).toMatchObject({
      name: "Lemon toast",
      cuisine: "Mediterranean",
      mealType: "Lunch",
      servingInfo: { prepTime: "PT10M", servings: 4 },
      ingredients: { default: ["2 lemons", "4 slices bread"] },
      instructions: [
        { number: 1, text: "Toast the bread." },
        { number: 2, text: "Add lemon." },
      ],
      images: [
        {
          imageUrl: "https://recipes.example.org/lemon-toast.jpg",
          isPrimary: true,
        },
        {
          imageUrl: "https://images.example.org/lemon.jpg",
          isPrimary: false,
        },
      ],
    });
  });

  it("rejects pages without structured Recipe data", async () => {
    mockedFetchPublicHtml.mockResolvedValue(
      '<script type="application/ld+json">{"@type":"WebPage"}</script>',
    );

    await expect(
      new ImportRecipeFromUrl().execute("https://recipes.example.org/page"),
    ).rejects.toThrow("No structured recipe data found");
  });
});
