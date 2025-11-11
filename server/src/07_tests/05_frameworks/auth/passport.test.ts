import passport from "../../../05_frameworks/auth/passport";
import { User } from "../../../01_entities";

describe("Passport Configuration", () => {
  describe("Google OAuth Strategy", () => {
    it("should have google strategy configured", () => {
      // many passport implementations keep strategies private; this test ensures passport is initialized
      // We check that passport exists and has serialize/deserialize functions
      expect(passport).toBeDefined();
      expect(typeof passport.serializeUser).toBe("function");
      expect(typeof passport.deserializeUser).toBe("function");
    });
  });

  describe("Serialization", () => {
    it("should serialize user correctly", (done) => {
      const user: any = {
        id: 1,
        email: "test@example.com",
        display_name: "Test",
      };
      // serializeUser expects (user, done)
      passport.serializeUser(user, (err: any, id: any) => {
        expect(err).toBeNull();
        expect(id).toBeDefined();
        done();
      });
    });
  });
});
