import { Request, Response } from "express";
import { injectable, inject } from "tsyringe";
import { ImportRecipeFromUrl } from "../../02_use_cases/ImportRecipeFromUrl";

@injectable()
export class RecipeImportController {
  constructor(
    @inject(ImportRecipeFromUrl)
    private importRecipeFromUrl: ImportRecipeFromUrl,
  ) {}

  async importUrl(req: Request, res: Response): Promise<void> {
    const url = req.body?.url;
    if (typeof url !== "string" || !url.trim()) {
      res.status(400).json({ error: "A recipe URL is required" });
      return;
    }

    try {
      const parsed = await this.importRecipeFromUrl.execute(url.trim());
      res.status(200).json({
        parsed,
        imageUrls: parsed.images.map((image) => image.imageUrl),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Recipe import failed";
      const isUrlValidationError =
        message.includes("URL") ||
        message.includes("host") ||
        message.includes("HTTP") ||
        message.includes("port") ||
        message.includes("credentials");
      res.status(isUrlValidationError ? 400 : 422).json({ error: message });
    }
  }
}

export default RecipeImportController;
