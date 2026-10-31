import { Request, Response } from "express";
import { ImportRecipeFromUrl } from "../02_use_cases/ImportRecipeFromUrl";
import { RecipeImportController } from "../03_adapters/controllers/RecipeImportController";

const parsedRecipe = {
  name: "Tomato pasta",
  ingredients: { default: ["pasta"] },
  instructions: [{ number: 1, text: "Cook pasta." }],
  notes: [],
  images: [{ imageUrl: "https://example.org/pasta.jpg", isPrimary: true }],
};

function makeResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe("RecipeImportController", () => {
  it("returns the parsed recipe and image URLs", async () => {
    const execute = jest.fn().mockResolvedValue(parsedRecipe);
    const controller = new RecipeImportController({
      execute,
    } as unknown as ImportRecipeFromUrl);
    const res = makeResponse();

    await controller.importUrl(
      { body: { url: " https://example.org/recipe " } } as Request,
      res as unknown as Response,
    );

    expect(execute).toHaveBeenCalledWith("https://example.org/recipe");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      parsed: parsedRecipe,
      imageUrls: ["https://example.org/pasta.jpg"],
    });
  });

  it("returns 400 for a missing URL", async () => {
    const execute = jest.fn();
    const controller = new RecipeImportController({
      execute,
    } as unknown as ImportRecipeFromUrl);
    const res = makeResponse();

    await controller.importUrl(
      { body: {} } as Request,
      res as unknown as Response,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for URL validation errors and 422 for pages without recipes", async () => {
    const invalidUrlController = new RecipeImportController({
      execute: jest
        .fn()
        .mockRejectedValue(new Error("This host is not allowed")),
    } as unknown as ImportRecipeFromUrl);
    const invalidResponse = makeResponse();
    await invalidUrlController.importUrl(
      { body: { url: "http://127.0.0.1" } } as Request,
      invalidResponse as unknown as Response,
    );
    expect(invalidResponse.status).toHaveBeenCalledWith(400);

    const missingRecipeController = new RecipeImportController({
      execute: jest
        .fn()
        .mockRejectedValue(
          new Error("No structured recipe data found on that page"),
        ),
    } as unknown as ImportRecipeFromUrl);
    const missingRecipeResponse = makeResponse();
    await missingRecipeController.importUrl(
      { body: { url: "https://example.org/page" } } as Request,
      missingRecipeResponse as unknown as Response,
    );
    expect(missingRecipeResponse.status).toHaveBeenCalledWith(422);
  });
});
