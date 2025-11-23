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
const circuitBreaker_1 = require("../myexpress/gateway/circuitBreaker");
// Helper: when running on GCP (Cloud Run), the server can obtain an ID token
// for the default service account by calling the metadata server. This token
// can be used to authenticate to another Cloud Run service that requires
// IAM-signed ID tokens.
// Simple in-memory cache for an ID token and its expiry time.
let cachedIdToken = null;
let cachedIdTokenExpiry = 0; // epoch ms
function parseJwtExpiry(token) {
    try {
        const parts = token.split(".");
        if (parts.length < 2)
            return 0;
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
        if (payload && typeof payload.exp === "number")
            return payload.exp * 1000;
    }
    catch (err) {
        // ignore parse errors
    }
    return 0;
}
function fetchIdToken(audience) {
    return __awaiter(this, void 0, void 0, function* () {
        // Return cached token if present and not expired (with 60s safety margin)
        const now = Date.now();
        if (cachedIdToken && cachedIdTokenExpiry - 60000 > now) {
            return cachedIdToken;
        }
        // Metadata endpoint - try both hosts commonly available in Cloud Run
        const mdUrls = [
            `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`,
            `http://metadata/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`,
        ];
        for (const u of mdUrls) {
            try {
                const resp = yield fetch(u, { headers: { "Metadata-Flavor": "Google" } });
                if (resp.ok) {
                    const token = (yield resp.text()).trim();
                    if (token) {
                        // Parse expiry from JWT and cache it
                        const expMs = parseJwtExpiry(token);
                        if (expMs > 0) {
                            cachedIdToken = token;
                            cachedIdTokenExpiry = expMs;
                        }
                        else {
                            // Fallback: cache for 50 minutes if we can't parse expiry
                            cachedIdToken = token;
                            cachedIdTokenExpiry = Date.now() + 50 * 60 * 1000;
                        }
                        return cachedIdToken;
                    }
                }
            }
            catch (err) {
                // ignore and try next
            }
        }
        return null;
    });
}
function cleanRecipe(recipe) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = process.env.CLEAN_RECIPE_SERVICE_URL;
        if (!url) {
            // Local fallback (synchronous)
            return (0, recipe_service_1.cleanRecipe)(recipe);
        }
        try {
            const endpoint = `${url.replace(/\/$/, "")}/clean-recipe`;
            // If the target service requires IAM authentication (Cloud Run private),
            // request an ID token from the metadata server and include it as a
            // Bearer token. The audience should be the service URL by default but can
            // be overridden with CLEAN_RECIPE_SERVICE_AUDIENCE env var.
            const audience = process.env.CLEAN_RECIPE_SERVICE_AUDIENCE || url.replace(/\/$/, "");
            let headers = {
                "Content-Type": "application/json",
            };
            try {
                const idToken = yield fetchIdToken(audience);
                if (idToken) {
                    headers["Authorization"] = `Bearer ${idToken}`;
                }
            }
            catch (err) {
                // If metadata request fails, continue without Authorization header.
                // The call will fail server-side if authentication is required.
                // eslint-disable-next-line no-console
                console.warn("Failed to obtain ID token for clean service auth:", err && err.message);
            }
            // Wrap the call with circuit breaker to prevent cascade failures
            const cleaned = yield (0, circuitBreaker_1.callWithCircuitBreaker)("clean-recipe-service", () => __awaiter(this, void 0, void 0, function* () {
                const resp = yield fetch(endpoint, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(recipe),
                });
                if (!resp.ok) {
                    const body = yield resp.text();
                    throw new Error(`Clean service error: ${resp.status} ${body}`);
                }
                return yield resp.json();
            }));
            return cleaned;
        }
        catch (err) {
            if (err instanceof circuitBreaker_1.CircuitBreakerError) {
                console.warn("Circuit breaker open for clean-recipe-service, falling back to local clean");
            }
            else {
                console.warn("clean-recipe-service unavailable or auth failed, falling back to local clean:", err && err.message);
            }
            return (0, recipe_service_1.cleanRecipe)(recipe);
        }
    });
}
exports.default = { cleanRecipe };
