"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurePassport = configurePassport;
const passport_1 = __importDefault(require("passport"));
const passport_google_oidc_1 = require("passport-google-oidc");
const database_1 = __importDefault(require("../database"));
const pg_1 = require("pg");
const crypto_1 = __importDefault(require("crypto"));
// Create a separate test pool if in test mode
const dbPool = process.env.NODE_ENV === "test"
    ? new pg_1.Pool({
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: parseInt(process.env.PG_PORT || "5432"),
    })
    : database_1.default;
function configurePassport() {
    if (!process.env.GOOGLE_CLIENT_ID ||
        !process.env.GOOGLE_CLIENT_SECRET ||
        !process.env.GOOGLE_CALLBACK_URL) {
        throw new Error("Google OAuth environment variables are not properly defined.");
    }
    passport_1.default.use(new passport_google_oidc_1.Strategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ["openid", "profile", "email"],
        passReqToCallback: true,
    }, (req, issuer, profile, done) => __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("OAuth profile received:", JSON.stringify(profile, null, 2));
            // Check if profile exists
            if (!profile || !profile.id) {
                return done(new Error("Invalid profile data received from Google"));
            }
            // Extract email from profile
            const email = profile.emails && profile.emails.length > 0
                ? profile.emails[0].value
                : `user-${profile.id}@example.com`;
            // Extract Google ID
            const googleId = profile.id;
            // Check for existing user
            const userResult = yield dbPool.query(`SELECT id, google_sub, email, display_name 
           FROM users 
           WHERE google_sub = $1`, [googleId]);
            let user = userResult.rows[0];
            if (!user) {
                // Extract display name
                const displayName = profile.displayName ||
                    (profile.name
                        ? `${profile.name.givenName || ""} ${profile.name.familyName || ""}`.trim()
                        : email.split("@")[0]);
                // Extract profile picture
                const avatar = profile.photos && profile.photos.length > 0
                    ? profile.photos[0].value
                    : null;
                const tokenExpiry = new Date();
                tokenExpiry.setHours(tokenExpiry.getHours() + 1);
                const insertResult = yield dbPool.query(`INSERT INTO users (
              google_sub, 
              email, 
              display_name, 
              avatar, 
              google_access_token,
              google_refresh_token,
              token_expiry
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id`, [
                    googleId,
                    email,
                    displayName,
                    avatar,
                    profile.accessToken ? encryptToken(profile.accessToken) : null,
                    profile.refreshToken
                        ? encryptToken(profile.refreshToken)
                        : null,
                    tokenExpiry.toISOString(),
                ]);
                const newUserResult = yield dbPool.query(`SELECT id, email, display_name 
             FROM users 
             WHERE id = $1`, [insertResult.rows[0].id]);
                user = newUserResult.rows[0];
                console.log("Created new user:", user);
                // Create default game_stats for the new user so stats persist
                yield dbPool.query(`INSERT INTO game_stats (user_id) VALUES ($1)`, [
                    user.id,
                ]);
                console.log(`Initialized game_stats for user ${user.id}`);
            }
            else {
                console.log("Found existing user:", user);
                // Ensure game_stats exists for this user
                try {
                    const statsCheck = yield dbPool.query(`SELECT 1 FROM game_stats WHERE user_id = $1`, [user.id]);
                    if (statsCheck.rows.length === 0) {
                        yield dbPool.query(`INSERT INTO game_stats (user_id) VALUES ($1)`, [user.id]);
                        console.log(`Initialized game_stats for existing user ${user.id}`);
                    }
                }
                catch (statsErr) {
                    console.error("Error ensuring game_stats for user", user.id, statsErr);
                }
            }
            return done(null, user);
        }
        catch (err) {
            console.error("OAuth error:", err);
            return done(err);
        }
    })));
}
function encryptToken(token) {
    try {
        const encryptionKey = process.env.DB_ENCRYPTION_KEY;
        if (!encryptionKey) {
            console.warn("DB_ENCRYPTION_KEY is missing! Using a fallback key for development.");
            // Use a fallback key for development/testing only
            const fallbackKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
            const iv = crypto_1.default.randomBytes(16);
            const cipher = crypto_1.default.createCipheriv("aes-256-gcm", Buffer.from(fallbackKey, "hex"), iv);
            return iv.toString("hex") + ":" + cipher.update(token, "utf8", "hex");
        }
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv("aes-256-gcm", Buffer.from(encryptionKey, "hex"), iv);
        return iv.toString("hex") + ":" + cipher.update(token, "utf8", "hex");
    }
    catch (error) {
        console.error("Token encryption error:", error);
        // In case of error, return a safely marked unencrypted token
        return `unencrypted:${token.substring(0, 5)}...`;
    }
}
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("deserializeUser called with id:", id);
        console.log("Attempting to query user with id:", id);
        const result = yield dbPool.query(`SELECT id, email, display_name 
       FROM users 
       WHERE id = $1`, [id]);
        console.log("User query result:", result.rows[0]);
        console.log("Calling done with:", result.rows[0] || false);
        done(null, result.rows[0] || false);
    }
    catch (err) {
        console.error("Deserialization error:", err);
        done(err instanceof Error ? err : undefined);
    }
}));
exports.default = passport_1.default;
