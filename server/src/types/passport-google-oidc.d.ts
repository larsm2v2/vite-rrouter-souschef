// types/entities/passport-google-oidc.d.ts
declare module "passport-google-oidc" {
  import { Strategy as PassportStrategy } from "passport";
  import { Request } from "express";

  export interface Profile {
    id: string;
    display_name: string;
    _json: {
      sub: string;
      email: string;
      email_verified: boolean;
      picture?: string;
      name?: string;
    };
    accessToken?: string;
    refreshToken?: string;
  }

  export type VerifyCallback = (
    error: Error | null,
    user?: object | false,
    info?: unknown
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(
      options: {
        clientID: string;
        clientSecret: string;
        callbackURL: string;
        scope?: string[];
        passReqToCallback: boolean;
      },
      verify: (
        req: Request,
        issuer: string,
        profile: Profile,
        done: VerifyCallback
      ) => void
    );
  }
}
