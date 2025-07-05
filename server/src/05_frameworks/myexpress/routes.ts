import { Router } from "express";
import authRoutes from "../../routes/auth.routes";
import profileRoutes from "../../routes/profile";
import recipeRoutes from "../../routes/recipes.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/profile", profileRoutes);
router.use("/recipes", recipeRoutes);

export default router;
