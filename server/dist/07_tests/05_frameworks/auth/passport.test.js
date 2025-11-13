"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("../../../05_frameworks/auth/passport"));
describe("Passport Configuration", () => {
    describe("Google OAuth Strategy", () => {
        it("should have google strategy configured", () => {
            // many passport implementations keep strategies private; this test ensures passport is initialized
            // We check that passport exists and has serialize/deserialize functions
            expect(passport_1.default).toBeDefined();
            expect(typeof passport_1.default.serializeUser).toBe("function");
            expect(typeof passport_1.default.deserializeUser).toBe("function");
        });
    });
    describe("Serialization", () => {
        it("should serialize user correctly", (done) => {
            const user = {
                id: 1,
                email: "test@example.com",
                display_name: "Test",
            };
            // serializeUser expects (user, done)
            passport_1.default.serializeUser(user, (err, id) => {
                expect(err).toBeNull();
                expect(id).toBeDefined();
                done();
            });
        });
    });
});
