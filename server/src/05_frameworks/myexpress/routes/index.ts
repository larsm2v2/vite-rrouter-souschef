import express from "express";
import authRoutes from "./auth.routes";

console.log("📋 About to import auth-google-pkce.routes...");
import authGooglePkceRoutes from "./auth-google-pkce.routes";
console.log(
  "✅ auth-google-pkce.routes imported:",
  typeof authGooglePkceRoutes
);

import profileRoutes from "./profile";
import recipesRoutes from "./recipes.routes";
import groceryRoutes from "./grocery.routes";
import profileFeatures from "./profileFeatures.routes";

const router = express.Router();

// Use PKCE-enabled Google OAuth routes (replaces passport-google-oauth20)
router.use("/auth", authGooglePkceRoutes);
router.use("/auth", authRoutes); // Keep other auth routes (login, register, refresh, etc.)
router.use("/api", recipesRoutes);
router.use("/api", groceryRoutes);
router.use("/", profileRoutes);
router.use("/api", profileFeatures);

export default router;
