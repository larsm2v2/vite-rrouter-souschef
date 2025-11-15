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
const passport_google_oauth20_1 = require("passport-google-oauth20");
const connection_1 = __importDefault(require("../database/connection"));
const pg_1 = require("pg");
const crypto_1 = __importDefault(require("crypto"));
const dbPool = process.env.NODE_ENV === "test"
    ? new pg_1.Pool({
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: parseInt(process.env.PG_PORT || "5432"),
    })
    : connection_1.default;
// Note: Express.User type is defined centrally in src/types/express.d.ts
function configurePassport() {
    if (!process.env.GOOGLE_CLIENT_ID ||
        !process.env.GOOGLE_CLIENT_SECRET ||
        !process.env.GOOGLE_CALLBACK_URL) {
        throw new Error("Google OAuth environment variables are not properly defined.");
    }
    passport_1.default.use(new passport_google_oauth20_1.Strategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        scope: ["openid", "profile", "email"],
    }, (accessToken, refreshToken, profile, done) => __awaiter(this, void 0, void 0, function* () {
        try {
            if (!profile || !profile.id) {
                return done(new Error("Invalid profile data received from Google"));
            }
            const email = profile.emails && profile.emails.length > 0
                ? profile.emails[0].value
                : `user-${profile.id}@example.com`;
            const googleId = profile.id;
            let user;
            try {
                const userResult = yield dbPool.query(`SELECT id, google_sub, email, display_name 
             FROM users 
             WHERE google_sub = $1`, [googleId]);
                user = userResult.rows[0];
                if (!user) {
                    const displayName = profile.displayName ||
                        (profile.name
                            ? `${profile.name.givenName || ""} ${profile.name.familyName || ""}`.trim()
                            : email.split("@")[0]);
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
                        accessToken ? encryptToken(accessToken) : null,
                        refreshToken ? encryptToken(refreshToken) : null,
                        tokenExpiry.toISOString(),
                    ]);
                    const newUserResult = yield dbPool.query(`SELECT id, email, display_name 
             FROM users 
             WHERE id = $1`, [insertResult.rows[0].id]);
                    user = newUserResult.rows[0];
                }
            }
            catch (dbError) {
                console.error("Database error during OAuth, using temporary user:", dbError);
                // If database fails, create a temporary user object to allow authentication to proceed
                const displayName = profile.displayName ||
                    (profile.name
                        ? `${profile.name.givenName || ""} ${profile.name.familyName || ""}`.trim()
                        : email.split("@")[0]);
                user = {
                    id: -1, // Temporary ID to indicate DB save pending
                    google_sub: googleId,
                    email: email,
                    display_name: displayName,
                };
            }
            return done(null, user);
        }
        catch (err) {
            return done(err);
        }
    })));
}
function encryptToken(token) {
    try {
        const encryptionKey = process.env.DB_ENCRYPTION_KEY;
        if (!encryptionKey) {
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
        return `unencrypted:${token.substring(0, 5)}...`;
    }
}
passport_1.default.serializeUser((user, done) => {
    done(null, user.id);
});
passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield connection_1.default.query(`SELECT id, email, display_name 
       FROM users 
       WHERE id = $1`, [id]);
        done(null, result.rows[0] || false);
    }
    catch (err) {
        done(err instanceof Error ? err : undefined);
    }
}));
exports.default = passport_1.default;
