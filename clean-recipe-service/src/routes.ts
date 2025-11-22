import express from "express";
import { cleanRecipe } from "./cleanRecipe";

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
    res.status(400).json({ error: error.message });
  }
});

export default router;
