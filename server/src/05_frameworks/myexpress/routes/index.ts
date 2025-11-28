import express from "express";
import authRoutes from "./auth.routes";
import oauthGoogleRoutes from "./oauth-google.routes";
import profileRoutes from "./profile";
import recipesRoutes from "./recipes.routes";
import groceryRoutes from "./grocery.routes";
import profileFeatures from "./profileFeatures.routes";
import ocrRoutes from "../../../routes/ocr";

const router = express.Router();

console.log("📋 Mounting routes...");
console.log("Environment for routes mount: NODE_ENV=", process.env.NODE_ENV);

// Mount all routes
console.log("  Mounting /api/oauth → oauth-google routes");
router.use("/api/oauth", oauthGoogleRoutes); // Client-side PKCE token exchange
console.log(
  "    -> oauthGoogleRoutes loaded?",
  typeof oauthGoogleRoutes,
  "stackLength",
  oauthGoogleRoutes?.stack?.length
);

console.log("  Mounting /auth → auth routes");
router.use("/auth", authRoutes); // Traditional auth routes (login, register, refresh, etc.)
console.log(
  "    -> authRoutes loaded?",
  typeof authRoutes,
  "stackLength",
  authRoutes?.stack?.length
);

console.log("  Mounting /api/recipes → recipes routes");
router.use("/api/recipes", recipesRoutes);
console.log(
  "    -> recipesRoutes loaded?",
  typeof recipesRoutes,
  "stackLength",
  recipesRoutes?.stack?.length
);

// Note: /api/clean-recipes endpoint removed - cleaning now only happens when creating new recipes

console.log("  Mounting /api → grocery routes");
router.use("/api", groceryRoutes);
console.log(
  "    -> groceryRoutes loaded?",
  typeof groceryRoutes,
  "stackLength",
  groceryRoutes?.stack?.length
);

console.log("  Mounting / → profile routes");
router.use("/", profileRoutes);
console.log(
  "    -> profileRoutes loaded?",
  typeof profileRoutes,
  "stackLength",
  profileRoutes?.stack?.length
);

console.log("  Mounting /api → profile features routes");
router.use("/api", profileFeatures);
console.log(
  "    -> profileFeatures loaded?",
  typeof profileFeatures,
  "stackLength",
  profileFeatures?.stack?.length
);

console.log("  Mounting /api → ocr routes");
router.use("/api", ocrRoutes);
console.log(
  "    -> ocrRoutes loaded?",
  typeof ocrRoutes,
  "stackLength",
  ocrRoutes?.stack?.length
);

console.log(
  `✅ Routes mounted successfully. Total routers: ${router.stack.length}`
);

export default router;
