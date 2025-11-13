"use strict";
// Wrapper to optionally use the clean-recipe-service microservice.
// If CLEAN_RECIPE_SERVICE_URL is set (e.g. http://localhost:6000), we
// POST the recipe to the service. Otherwise we fallback to the local
// cleanRecipe implementation in `src/services/recipe.service.ts`.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanRecipe = cleanRecipe;
const recipe_service_1 = require("../../services/recipe.service");
function cleanRecipe(recipe) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = process.env.CLEAN_RECIPE_SERVICE_URL;
        if (!url) {
            // Local fallback (synchronous)
            return (0, recipe_service_1.cleanRecipe)(recipe);
        }
        try {
            // Use global fetch (Node 18+). If your environment doesn't expose fetch,
            // consider installing 'node-fetch' or 'cross-fetch'.
            const resp = yield fetch(`${url.replace(/\/$/, "")}/clean-recipe`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(recipe),
            });
            if (!resp.ok) {
                const body = yield resp.text();
                throw new Error(`Clean service error: ${resp.status} ${body}`);
            }
            const cleaned = yield resp.json();
            // Ensure the cleaned recipe is returned in expected shape. The microservice
            // may not add fields like uniqueId—leave that to the caller if needed.
            return cleaned;
        }
        catch (err) {
            // On network/other error, surface a helpful message but fall back to local
            // cleaning to avoid breaking the main flow.
            // eslint-disable-next-line no-console
            console.warn("clean-recipe-service unavailable, falling back to local clean:", err && err.message);
            return (0, recipe_service_1.cleanRecipe)(recipe);
        }
    });
}
exports.default = { cleanRecipe };
