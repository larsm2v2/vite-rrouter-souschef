import express from "express";
import authRoutes from "./auth.routes";
import oauthGoogleRoutes from "./oauth-google.routes";
import profileRoutes from "./profile";
import recipesRoutes from "./recipes.routes";
import groceryRoutes from "./grocery.routes";
import profileFeatures from "./profileFeatures.routes";

const router = express.Router();

// Mount all routes
router.use("/api/oauth", oauthGoogleRoutes); // Client-side PKCE token exchange
router.use("/auth", authRoutes); // Traditional auth routes (login, register, refresh, etc.)
router.use("/api", recipesRoutes);
router.use("/api", groceryRoutes);
router.use("/", profileRoutes);
router.use("/api", profileFeatures);

console.log(
  `Routes mounted successfully. Total routers: ${router.stack.length}`
);

export default router;
