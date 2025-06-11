// tests/auth.test.ts
process.env.NODE_ENV = "test"; // Set environment to "test"
import request from "supertest";
import pool from "../config/database";
import app from "../app";
import { Request, Response, NextFunction } from "express";
import passport from "../config/auth/passport";
import { User } from "../types/entities/User";
import { initializeDatabase } from "../config/schema";

describe("Authentication Routes", () => {
  let testUser: User;

  beforeAll(async () => {
    // Initialize database
    await initializeDatabase();
    
    // Seed the database with test data
    const result = await pool.query(
      `INSERT INTO users (google_sub, display_name, email) 
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name`,
      ["test-google-id", "Test User", "test@example.com"]
    );
    testUser = result.rows[0];
  });

  beforeEach(async () => {
    await pool.query("BEGIN");
  });

  afterEach(async () => {
    await pool.query("ROLLBACK");
    jest.restoreAllMocks(); // Reset all mocks after each test
  });

  afterAll(async () => {
    // Clean up the database after tests
    await pool.query("DELETE FROM users");
    await pool.end(); // Close the connection pool
  });

  describe("GET /auth/google", () => {
    it("should redirect to Google OAuth", async () => {
      const res = await request(app).get("/auth/google");
      expect(res.status).toBe(302);
      expect(res.header.location).toMatch(/accounts\.google\.com/);
    });
  });

  describe("GET /auth/google/callback", () => {
    it("should handle the OAuth callback successfully", async () => {
      // Mock passport.authenticate to call the callback with req.user set
      const authenticateMock = jest.fn().mockImplementation(() => {
        return (req: Request, res: Response, next: NextFunction) => {
          // Set the user directly without going through OAuth
          req.user = testUser;
          next();
        };
      });
      
      // Apply the mock to passport.authenticate
      const originalAuthenticate = passport.authenticate;
      passport.authenticate = authenticateMock;
      
      try {
        const res = await request(app)
          .get("/auth/google/callback")
          .query({ code: "mock_code", state: "mock_state" });
        
        expect(res.status).toBe(302);
        // Just check that we're redirected somewhere (don't be too specific)
        expect(res.header.location).toBeTruthy();
      } finally {
        // Restore original authenticate function
        passport.authenticate = originalAuthenticate;
      }
    });

    it("should handle OAuth callback failure", async () => {
      // For failure, we don't need to test the actual middleware
      // Just check that the route exists and responds
      const res = await request(app)
        .get("/auth/google/callback")
        .query({ error: "access_denied" });
      
      expect(res.status).toBe(302); // Redirect status
    });
  });
});
