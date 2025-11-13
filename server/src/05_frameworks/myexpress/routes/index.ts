import express from "express";
import authRoutes from "./auth.routes";
import profileRoutes from "./profile";
import recipesRoutes from "./recipes.routes";
import groceryRoutes from "./grocery.routes";
import profileFeatures from "./profileFeatures.routes";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/api", recipesRoutes);
router.use("/api", groceryRoutes);
router.use("/", profileRoutes);
router.use("/api", profileFeatures);

export default router;
