import express from "express";
import authRoutes from "./auth.routes";
import oauthGoogleRoutes from "./oauth-google.routes";
import profileRoutes from "./profile";
import recipesRoutes from "./recipes.routes";
import groceryRoutes from "./grocery.routes";
import profileFeatures from "./profileFeatures.routes";

const router = express.Router();

console.log("📋 Mounting routes...");

// Mount all routes
console.log("  Mounting /api/oauth → oauth-google routes");
router.use("/api/oauth", oauthGoogleRoutes); // Client-side PKCE token exchange

console.log("  Mounting /auth → auth routes");
router.use("/auth", authRoutes); // Traditional auth routes (login, register, refresh, etc.)

console.log("  Mounting /api → recipes routes");
router.use("/api", recipesRoutes);

console.log("  Mounting /api → grocery routes");
router.use("/api", groceryRoutes);

console.log("  Mounting / → profile routes");
router.use("/", profileRoutes);

console.log("  Mounting /api → profile features routes");
router.use("/api", profileFeatures);

console.log(
  `✅ Routes mounted successfully. Total routers: ${router.stack.length}`
);

export default router;
