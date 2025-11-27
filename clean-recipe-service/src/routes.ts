import express from "express";
import { cleanRecipe } from "./cleanRecipe";
import {
  canonicalizeIngredient,
  getVariants,
  hasSynonyms,
  getSynonymStats,
} from "./synonyms";

const router = express.Router();

router.post("/clean-recipe", (req, res) => {
  try {
    // Diagnostic: log authorization header presence and preview
    const auth = req.headers.authorization;
    const hasAuth = !!auth;
    let authPreview = null;
    if (hasAuth && typeof auth === "string") {
      authPreview =
        auth.length > 40 ? `${auth.slice(0, 20)}...${auth.slice(-12)}` : auth;
    }
    console.log(
      `/clean-recipe called: hasAuth=${hasAuth} authPreview=${
        authPreview || "none"
      } origin=${req.headers.origin || "none"} content-type=${
        req.headers["content-type"] || "none"
      }`
    );

    const cleanedRecipe = cleanRecipe(req.body);
    res.status(200).json(cleanedRecipe);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
});

// Synonym canonicalization endpoint
router.post("/canonicalize", (req, res) => {
  try {
    const { ingredient } = req.body;

    if (!ingredient || typeof ingredient !== "string") {
      res.status(400).json({
        error: "Missing or invalid 'ingredient' field",
      });
      return;
    }

    const canonical = canonicalizeIngredient(ingredient);
    const variants = getVariants(canonical);
    const hasVariants = hasSynonyms(ingredient);

    res.status(200).json({
      input: ingredient,
      canonical,
      hasVariants,
      variants: hasVariants ? variants : [],
      wasTransformed:
        canonical.toLowerCase() !== ingredient.toLowerCase().trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Batch canonicalization endpoint
router.post("/canonicalize-batch", (req, res) => {
  try {
    const { ingredients } = req.body;

    if (!Array.isArray(ingredients)) {
      res.status(400).json({
        error: "Expected 'ingredients' array",
      });
      return;
    }

    const results = ingredients.map((ingredient) => ({
      input: ingredient,
      canonical: canonicalizeIngredient(ingredient),
    }));

    res.status(200).json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Synonym statistics endpoint
router.get("/synonym-stats", (req, res) => {
  try {
    const stats = getSynonymStats();
    res.status(200).json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

export default router;
