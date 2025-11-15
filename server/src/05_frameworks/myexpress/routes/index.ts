console.log("🔵 START: routes/index.ts module is loading");

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

console.log("📋 All route modules imported. Creating router...");

const router = express.Router();

console.log("📋 Mounting routes to router...");
// Use PKCE-enabled Google OAuth routes (replaces passport-google-oauth20)
router.use("/auth", authGooglePkceRoutes);
console.log("   ✅ Mounted authGooglePkceRoutes on /auth");
router.use("/auth", authRoutes); // Keep other auth routes (login, register, refresh, etc.)
console.log("   ✅ Mounted authRoutes on /auth");
router.use("/api", recipesRoutes);
console.log("   ✅ Mounted recipesRoutes on /api");
router.use("/api", groceryRoutes);
console.log("   ✅ Mounted groceryRoutes on /api");
router.use("/", profileRoutes);
console.log("   ✅ Mounted profileRoutes on /");
router.use("/api", profileFeatures);
console.log("   ✅ Mounted profileFeatures on /api");
console.log(`📋 Router complete. Stack length: ${router.stack.length}`);

export default router;
