import passport from "passport";
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from "passport-google-oauth20";
import pool from "../database/connection";
import { Pool } from "pg";
import crypto from "crypto";
import { User } from "../../01_entities";

const dbPool =
  process.env.NODE_ENV === "test"
    ? new Pool({
        user: process.env.PG_USER,
        host: process.env.PG_HOST,
        database: process.env.PG_DATABASE,
        password: process.env.PG_PASSWORD,
        port: parseInt(process.env.PG_PORT || "5432"),
      })
    : (pool as any);

// Note: Express.User type is defined centrally in src/types/express.d.ts

export function configurePassport() {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.GOOGLE_CALLBACK_URL
  ) {
    throw new Error(
      "Google OAuth environment variables are not properly defined."
    );
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL!,
        scope: ["openid", "profile", "email"],
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        try {
          if (!profile || !profile.id) {
            return done(new Error("Invalid profile data received from Google"));
          }

          const email =
            profile.emails && profile.emails.length > 0
              ? profile.emails[0].value
              : `user-${profile.id}@example.com`;

          const googleId = profile.id;

          let user;

          try {
            const userResult = await dbPool.query(
              `SELECT id, google_sub, email, display_name 
             FROM users 
             WHERE google_sub = $1`,
              [googleId]
            );

            user = userResult.rows[0];

            if (!user) {
              const displayName =
                profile.displayName ||
                (profile.name
                  ? `${profile.name.givenName || ""} ${
                      profile.name.familyName || ""
                    }`.trim()
                  : email.split("@")[0]);

              const avatar =
                profile.photos && profile.photos.length > 0
                  ? profile.photos[0].value
                  : null;

              const tokenExpiry = new Date();
              tokenExpiry.setHours(tokenExpiry.getHours() + 1);

              const insertResult = await dbPool.query(
                `INSERT INTO users (
                google_sub, 
                email, 
                display_name, 
                avatar, 
                google_access_token,
                google_refresh_token,
                token_expiry
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              RETURNING id`,
                [
                  googleId,
                  email,
                  displayName,
                  avatar,
                  accessToken ? encryptToken(accessToken) : null,
                  refreshToken ? encryptToken(refreshToken) : null,
                  tokenExpiry.toISOString(),
                ]
              );

              const newUserResult = await dbPool.query(
                `SELECT id, email, display_name 
             FROM users 
             WHERE id = $1`,
                [insertResult.rows[0].id]
              );

              user = newUserResult.rows[0];
            }
          } catch (dbError) {
            console.error(
              "Database error during OAuth, using temporary user:",
              dbError
            );
            // If database fails, create a temporary user object to allow authentication to proceed
            const displayName =
              profile.displayName ||
              (profile.name
                ? `${profile.name.givenName || ""} ${
                    profile.name.familyName || ""
                  }`.trim()
                : email.split("@")[0]);

            user = {
              id: -1, // Temporary ID to indicate DB save pending
              google_sub: googleId,
              email: email,
              display_name: displayName,
            };
          }

          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );
}

function encryptToken(token: string): string {
  try {
    const encryptionKey = process.env.DB_ENCRYPTION_KEY;
    if (!encryptionKey) {
      const fallbackKey =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(fallbackKey, "hex"),
        iv
      );
      return iv.toString("hex") + ":" + cipher.update(token, "utf8", "hex");
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from(encryptionKey, "hex"),
      iv
    );
    return iv.toString("hex") + ":" + cipher.update(token, "utf8", "hex");
  } catch (error) {
    return `unencrypted:${token.substring(0, 5)}...`;
  }
}

passport.serializeUser<number>((user: Express.User, done) => {
  done(null, user.id);
});

passport.deserializeUser<number>(async (id: number, done) => {
  try {
    const result = await (pool as any).query(
      `SELECT id, email, display_name 
       FROM users 
       WHERE id = $1`,
      [id]
    );
    done(null, result.rows[0] || false);
  } catch (err) {
    done(err instanceof Error ? err : undefined);
  }
});

export default passport;
