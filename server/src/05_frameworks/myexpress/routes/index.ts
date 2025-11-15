console.log("[ROUTES INDEX] START: routes/index.ts module is loading");

import express from "express";
import authRoutes from "./auth.routes";

console.log("[ROUTES INDEX] About to import auth-google-pkce.routes...");
import authGooglePkceRoutes from "./auth-google-pkce.routes";
console.log(
  "[ROUTES INDEX] auth-google-pkce.routes imported:",
  typeof authGooglePkceRoutes
);

import profileRoutes from "./profile";
import recipesRoutes from "./recipes.routes";
import groceryRoutes from "./grocery.routes";
import profileFeatures from "./profileFeatures.routes";

console.log("[ROUTES INDEX] All route modules imported. Creating router...");
console.log(
  "[ROUTES INDEX] authGooglePkceRoutes type:",
  typeof authGooglePkceRoutes
);
console.log(
  "[ROUTES INDEX] authGooglePkceRoutes stack:",
  authGooglePkceRoutes?.stack?.length
);
console.log("[ROUTES INDEX] authRoutes type:", typeof authRoutes);
console.log("[ROUTES INDEX] authRoutes stack:", authRoutes?.stack?.length);

const router = express.Router();

console.log("[ROUTES INDEX] Mounting routes to router...");
// Use PKCE-enabled Google OAuth routes (replaces passport-google-oauth20)
router.use("/auth", authGooglePkceRoutes);
console.log("[ROUTES INDEX] Mounted authGooglePkceRoutes on /auth");
router.use("/auth", authRoutes); // Keep other auth routes (login, register, refresh, etc.)
console.log("[ROUTES INDEX] Mounted authRoutes on /auth");
router.use("/api", recipesRoutes);
console.log("[ROUTES INDEX] Mounted recipesRoutes on /api");
router.use("/api", groceryRoutes);
console.log("[ROUTES INDEX] Mounted groceryRoutes on /api");
router.use("/", profileRoutes);
console.log("[ROUTES INDEX] Mounted profileRoutes on /");
router.use("/api", profileFeatures);
console.log("[ROUTES INDEX] Mounted profileFeatures on /api");
console.log(
  `[ROUTES INDEX] Router complete. Stack length: ${router.stack.length}`
);

export default router;
