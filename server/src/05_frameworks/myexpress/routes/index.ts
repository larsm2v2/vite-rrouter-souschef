import express from "express";
import authRoutes from "./auth.routes";
import authGooglePkceRoutes from "./auth-google-pkce.routes";
import profileRoutes from "./profile";
import recipesRoutes from "./recipes.routes";
import groceryRoutes from "./grocery.routes";
import profileFeatures from "./profileFeatures.routes";

const router = express.Router();

// Mount all routes
router.use("/auth", authGooglePkceRoutes); // Google OAuth PKCE routes
router.use("/auth", authRoutes); // Other auth routes (login, register, refresh, etc.)
router.use("/api", recipesRoutes);
router.use("/api", groceryRoutes);
router.use("/", profileRoutes);
router.use("/api", profileFeatures);

console.log(
  `Routes mounted successfully. Total routers: ${router.stack.length}`
);

export default router;
