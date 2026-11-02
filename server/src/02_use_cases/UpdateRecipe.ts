import { Recipe } from "../01_entities";
import { RecipeRepository } from "../03_adapters/repositories/RecipeRepository";
import { injectable, inject } from "tsyringe";

function badRequest(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 400 });
}

function boundedString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || value.length > max)
    throw badRequest(`${field} must be a string up to ${max} characters`);
  return value.trim();
}

@injectable()
export class UpdateRecipe {
  constructor(
    @inject(RecipeRepository) private recipeRepository: RecipeRepository,
  ) {}

  async execute(
    recipeId: number,
    input: unknown,
    userId: number,
  ): Promise<Recipe | null> {
    if (!Number.isInteger(recipeId) || recipeId <= 0)
      throw badRequest("Invalid recipe id");
    if (!Number.isInteger(userId) || userId <= 0)
      throw Object.assign(new Error("Unauthorized"), { status: 401 });
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw badRequest("Recipe body must be an object");

    const raw = input as Record<string, unknown>;
    const name = boundedString(raw.name, "name", 200);
    if (!name) throw badRequest("Recipe name is required");

    const optionalText = (value: unknown, field: string, max: number) =>
      value === undefined || value === null || value === ""
        ? ""
        : boundedString(value, field, max);

    const rawRestrictions =
      raw.dietaryRestrictions ?? raw.dietary_restrictions ?? [];
    if (
      !Array.isArray(rawRestrictions) ||
      rawRestrictions.length > 30 ||
      rawRestrictions.some(
        (item) => typeof item !== "string" || item.length > 100,
      )
    )
      throw badRequest("dietaryRestrictions must be an array of short strings");

    const rawServing = raw.servingInfo ?? raw.serving_info ?? {};
    if (
      !rawServing ||
      typeof rawServing !== "object" ||
      Array.isArray(rawServing)
    )
      throw badRequest("servingInfo must be an object");
    const serving = rawServing as Record<string, unknown>;
    const rawServings = serving.servings;
    const servings =
      rawServings === undefined || rawServings === null || rawServings === ""
        ? 0
        : Number(rawServings);
    if (!Number.isInteger(servings) || servings < 0 || servings > 999)
      throw badRequest("servings must be a whole number between 0 and 999");

    const rawIngredients = raw.ingredients ?? {};
    if (
      !rawIngredients ||
      typeof rawIngredients !== "object" ||
      Array.isArray(rawIngredients)
    )
      throw badRequest("ingredients must be an object of ingredient groups");
    const ingredients: NonNullable<Recipe["ingredients"]> = {};
    for (const [group, entries] of Object.entries(
      rawIngredients as Record<string, unknown>,
    )) {
      if (
        !group.trim() ||
        group.length > 80 ||
        !Array.isArray(entries) ||
        entries.length > 500
      )
        throw badRequest(
          "Each ingredient group must be a named array of at most 500 items",
        );
      const cleanEntries = entries.map((entry) => {
        if (typeof entry === "string") {
          if (entry.length > 1000)
            throw badRequest("Ingredient text is too long");
          return entry;
        }
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
          throw badRequest("Ingredients must be text or ingredient objects");
        const item = entry as Record<string, unknown>;
        if (typeof item.name !== "string" || item.name.length > 300)
          throw badRequest(
            "Structured ingredients need a name up to 300 characters",
          );
        const quantity =
          item.quantity === undefined ||
          item.quantity === null ||
          item.quantity === ""
            ? 0
            : Number(item.quantity);
        if (!Number.isFinite(quantity) || quantity < 0 || quantity > 1_000_000)
          throw badRequest("Ingredient quantity is invalid");
        const unit =
          item.unit === undefined || item.unit === null ? "" : item.unit;
        if (typeof unit !== "string" || unit.length > 40)
          throw badRequest(
            "Ingredient unit must be a string up to 40 characters",
          );
        return { ...item, name: item.name.trim(), quantity, unit };
      });
      ingredients[group] = cleanEntries as NonNullable<
        Recipe["ingredients"]
      >[string];
    }

    if (!Array.isArray(raw.instructions) || raw.instructions.length > 200)
      throw badRequest("instructions must be an array of at most 200 steps");
    const instructions = raw.instructions.map((step, index) => {
      const value =
        typeof step === "string"
          ? step
          : step && typeof step === "object" && !Array.isArray(step)
            ? String(
                (step as Record<string, unknown>).text ??
                  (step as Record<string, unknown>).instruction ??
                  "",
              )
            : null;
      if (value === null || value.length > 5000)
        throw badRequest(
          `Instruction ${index + 1} must be text up to 5000 characters`,
        );
      return { stepNumber: index + 1, instruction: value };
    });

    if (!Array.isArray(raw.notes) || raw.notes.length > 100)
      throw badRequest("notes must be an array of at most 100 strings");
    const notes = raw.notes.map((note) => boundedString(note, "note", 2000));

    const cuisine = optionalText(raw.cuisine, "cuisine", 100);
    const mealType = optionalText(
      raw.mealType ?? raw.meal_type,
      "mealType",
      100,
    );
    const servingInfo = {
      prepTime: optionalText(
        serving.prepTime ?? serving.prep_time,
        "prepTime",
        100,
      ),
      cookTime: optionalText(
        serving.cookTime ?? serving.cook_time,
        "cookTime",
        100,
      ),
      totalTime: optionalText(
        serving.totalTime ?? serving.total_time,
        "totalTime",
        100,
      ),
      servings,
    };

    return this.recipeRepository.update(
      recipeId,
      {
        name,
        cuisine,
        mealType,
        dietaryRestrictions: rawRestrictions as string[],
        servingInfo,
        ingredients,
        instructions,
        notes,
      } as Partial<Recipe>,
      userId,
    );
  }
}
