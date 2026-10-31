import { load } from "cheerio";
import { injectable } from "tsyringe";
import { fetchPublicHtml } from "../utils/safeUrlFetch";

export interface ImportedRecipe {
  name: string;
  cuisine?: string;
  mealType?: string;
  servingInfo?: {
    prepTime?: string;
    cookTime?: string;
    totalTime?: string;
    servings?: number;
  };
  ingredients: Record<string, string[]>;
  instructions: { number: number; text: string }[];
  notes: string[];
  images: { imageUrl: string; isPrimary: boolean }[];
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function values(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function strings(value: unknown): string[] {
  return values(value)
    .filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0,
    )
    .map((item) => item.trim());
}

function recipeType(value: unknown): boolean {
  return values(value).some(
    (item) =>
      typeof item === "string" &&
      item.split(/[\/#]/).pop()?.toLowerCase() === "recipe",
  );
}

function collectRecipes(
  value: unknown,
  found: JsonRecord[] = [],
): JsonRecord[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRecipes(item, found));
    return found;
  }
  if (!isRecord(value)) return found;

  if (recipeType(value["@type"])) found.push(value);
  if (value["@graph"]) collectRecipes(value["@graph"], found);
  if (value.mainEntity) collectRecipes(value.mainEntity, found);
  return found;
}

function instructionTexts(value: unknown): string[] {
  return values(value).flatMap((item) => {
    if (typeof item === "string") return [item.trim()].filter(Boolean);
    if (!isRecord(item)) return [];

    const type = values(item["@type"]);
    if (
      type.some(
        (entry) =>
          typeof entry === "string" &&
          entry.split(/[\/#]/).pop()?.toLowerCase() === "howtosection",
      )
    ) {
      return instructionTexts(item.itemListElement);
    }
    const text = item.text ?? item.name;
    return typeof text === "string" && text.trim() ? [text.trim()] : [];
  });
}

function safeImageUrl(value: unknown, pageUrl: URL): string | null {
  const imageValue =
    typeof value === "string"
      ? value
      : isRecord(value)
        ? (value.url ?? value.contentUrl)
        : null;
  if (typeof imageValue !== "string" || imageValue.length > 2048) return null;

  try {
    const imageUrl = new URL(imageValue, pageUrl);
    if (
      (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") ||
      imageUrl.username ||
      imageUrl.password
    ) {
      return null;
    }
    return imageUrl.toString();
  } catch {
    return null;
  }
}

function parseRecipe(recipe: JsonRecord, pageUrl: URL): ImportedRecipe {
  const name = typeof recipe.name === "string" ? recipe.name.trim() : "";
  if (!name) throw new Error("The structured recipe is missing a name");

  const images = values(recipe.image)
    .map((image) => safeImageUrl(image, pageUrl))
    .filter((image): image is string => image !== null && image.length > 0)
    .slice(0, 10)
    .map((imageUrl, index) => ({ imageUrl, isPrimary: index === 0 }));

  const yieldText = strings(recipe.recipeYield)[0];
  const servingsMatch = yieldText?.match(/\d+/);
  const servingInfo: ImportedRecipe["servingInfo"] = {};
  if (typeof recipe.prepTime === "string")
    servingInfo.prepTime = recipe.prepTime;
  if (typeof recipe.cookTime === "string")
    servingInfo.cookTime = recipe.cookTime;
  if (typeof recipe.totalTime === "string")
    servingInfo.totalTime = recipe.totalTime;
  if (servingsMatch) servingInfo.servings = Number(servingsMatch[0]);

  const cuisine = strings(recipe.recipeCuisine).join(", ");
  const mealType = strings(recipe.recipeCategory)[0];
  const description =
    typeof recipe.description === "string" ? recipe.description.trim() : "";

  return {
    name,
    ...(cuisine ? { cuisine } : {}),
    ...(mealType ? { mealType } : {}),
    ...(Object.keys(servingInfo).length ? { servingInfo } : {}),
    ingredients: { default: strings(recipe.recipeIngredient) },
    instructions: instructionTexts(recipe.recipeInstructions).map(
      (text, index) => ({ number: index + 1, text }),
    ),
    notes: [],
    images,
    ...(description ? { notes: [description] } : {}),
  };
}

@injectable()
export class ImportRecipeFromUrl {
  async execute(inputUrl: string): Promise<ImportedRecipe> {
    const html = await fetchPublicHtml(inputUrl);
    const $ = load(html);
    const pageUrl = new URL(inputUrl);
    const candidates: JsonRecord[] = [];

    $("script[type='application/ld+json']").each((_, script) => {
      const contents = $(script).contents().text();
      if (!contents) return;
      try {
        collectRecipes(JSON.parse(contents), candidates);
      } catch {
        // Pages may include unrelated or malformed JSON-LD blocks.
      }
    });

    if (candidates.length === 0) {
      throw new Error("No structured recipe data found on that page");
    }
    return parseRecipe(candidates[0], pageUrl);
  }
}

export default ImportRecipeFromUrl;
