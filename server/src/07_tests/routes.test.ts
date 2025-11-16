import express from "express";
import "reflect-metadata";
import "../04_factories/di"; // Initialize DI container
import routes from "../05_frameworks/myexpress/routes/index";
import authRoutes from "../05_frameworks/myexpress/routes/auth.routes";
import oauthGoogleRoutes from "../05_frameworks/myexpress/routes/oauth-google.routes";
import profileRoutes from "../05_frameworks/myexpress/routes/profile";
import recipesRoutes from "../05_frameworks/myexpress/routes/recipes.routes";
import groceryRoutes from "../05_frameworks/myexpress/routes/grocery.routes";
import profileFeatures from "../05_frameworks/myexpress/routes/profileFeatures.routes";

describe("Routes Module Tests", () => {
  describe("Individual Route Modules", () => {
    it("should import auth.routes successfully", () => {
      expect(authRoutes).toBeDefined();
      expect(typeof authRoutes).toBe("function");
      expect(authRoutes.stack).toBeDefined();
      console.log("auth.routes stack length:", authRoutes.stack?.length || 0);
    });

    it("should import oauth-google.routes successfully", () => {
      expect(oauthGoogleRoutes).toBeDefined();
      expect(typeof oauthGoogleRoutes).toBe("function");
      expect(oauthGoogleRoutes.stack).toBeDefined();
      console.log(
        "oauth-google.routes stack length:",
        oauthGoogleRoutes.stack?.length || 0
      );
    });

    it("should import profile routes successfully", () => {
      expect(profileRoutes).toBeDefined();
      expect(typeof profileRoutes).toBe("function");
      expect(profileRoutes.stack).toBeDefined();
      console.log(
        "profile routes stack length:",
        profileRoutes.stack?.length || 0
      );
    });

    it("should import recipes.routes successfully", () => {
      expect(recipesRoutes).toBeDefined();
      expect(typeof recipesRoutes).toBe("function");
      expect(recipesRoutes.stack).toBeDefined();
      console.log(
        "recipes.routes stack length:",
        recipesRoutes.stack?.length || 0
      );
    });

    it("should import grocery.routes successfully", () => {
      expect(groceryRoutes).toBeDefined();
      expect(typeof groceryRoutes).toBe("function");
      expect(groceryRoutes.stack).toBeDefined();
      console.log(
        "grocery.routes stack length:",
        groceryRoutes.stack?.length || 0
      );
    });

    it("should import profileFeatures.routes successfully", () => {
      expect(profileFeatures).toBeDefined();
      expect(typeof profileFeatures).toBe("function");
      expect(profileFeatures.stack).toBeDefined();
      console.log(
        "profileFeatures.routes stack length:",
        profileFeatures.stack?.length || 0
      );
    });
  });

  describe("Combined Routes Module", () => {
    it("should import routes index successfully", () => {
      expect(routes).toBeDefined();
      expect(typeof routes).toBe("function");
      expect(routes.stack).toBeDefined();
    });

    it("should have 6 route mounts in the routes stack", () => {
      console.log("\n=== ROUTES STACK ANALYSIS ===");
      console.log("Total routes.stack length:", routes.stack?.length || 0);
      console.log("\nRoutes stack details:");

      routes.stack?.forEach((layer: any, index: number) => {
        console.log(`\n[${index}] Layer:`, {
          name: layer.name,
          regexp: layer.regexp?.source || "no regexp",
          path: layer.route?.path || "no direct path",
          handle: typeof layer.handle,
          keys: layer.keys,
        });

        // If it's a router, show its routes
        if (layer.name === "router" && layer.handle?.stack) {
          console.log(`  Router has ${layer.handle.stack.length} routes:`);
          layer.handle.stack.forEach((route: any, i: number) => {
            console.log(`    [${i}]`, {
              path: route.route?.path || route.path || "unknown",
              methods: route.route?.methods || route.methods || "unknown",
            });
          });
        }
      });

      // Expected: 6 router middlewares (oauth, auth, recipes, grocery, profile, profileFeatures)
      expect(routes.stack.length).toBe(6);
    });

    it("should mount /api/oauth routes first", () => {
      const oauthLayer = routes.stack?.[0];
      expect(oauthLayer).toBeDefined();
      expect(oauthLayer.name).toBe("router");
      // Check the regexp matches /api/oauth
      expect(oauthLayer.regexp?.source).toContain("api");
      expect(oauthLayer.regexp?.source).toContain("oauth");
      // Extra check: ensure oauth router has /google/token route defined
      // Type guard to reach nested router stack
      const oauthHandle = oauthLayer?.handle as any;
      const tokenRoute = oauthHandle?.stack?.find(
        (l: any) => l.route?.path === "/google/token"
      );
      expect(tokenRoute).toBeDefined();
    });

    it("should mount /auth routes second", () => {
      const authLayer = routes.stack?.[1];
      expect(authLayer).toBeDefined();
      expect(authLayer.name).toBe("router");
      expect(authLayer.regexp?.source).toContain("auth");
    });
  });

  describe("Route Registration Test", () => {
    it("should register routes on an Express app correctly", () => {
      const testApp = express();
      testApp.use(routes);

      console.log("\n=== EXPRESS APP STACK ANALYSIS ===");
      console.log(
        "App middleware stack length:",
        testApp._router?.stack?.length || 0
      );

      testApp._router?.stack?.forEach((layer: any, index: number) => {
        if (layer.name === "router") {
          console.log(`\n[${index}] Router middleware:`, {
            regexp: layer.regexp?.source,
            routeCount: layer.handle?.stack?.length || 0,
          });
        }
      });

      // The app should have the routes mounted
      const routersInApp = testApp._router?.stack?.filter(
        (layer: any) => layer.name === "router"
      );

      console.log("\nTotal routers in app:", routersInApp?.length || 0);
      expect(routersInApp?.length).toBeGreaterThan(0);
    });
  });

  describe("OAuth Google Routes Specific Tests", () => {
    it("should have POST /google/token route in oauth-google.routes", () => {
      console.log("\n=== OAUTH GOOGLE ROUTES ANALYSIS ===");
      console.log("oauth-google routes stack:", oauthGoogleRoutes.stack);

      const postRoute = oauthGoogleRoutes.stack?.find(
        (layer: any) => layer.route?.path === "/google/token"
      );

      expect(postRoute).toBeDefined();
      expect((postRoute?.route as any)?.methods?.post).toBe(true);
    });

    it("should mount oauth routes at /api/oauth in main routes", () => {
      const oauthLayer = routes.stack?.[0] as any;

      console.log("\n=== OAUTH MOUNTING ANALYSIS ===");
      console.log("First layer in routes.stack:", {
        name: oauthLayer?.name,
        regexp: oauthLayer?.regexp?.source,
        handle: typeof oauthLayer?.handle,
        handleStack: oauthLayer?.handle?.stack?.length,
      });

      // Verify it's a router
      expect(oauthLayer?.name).toBe("router");

      // Verify it has routes inside
      expect(oauthLayer?.handle?.stack?.length).toBeGreaterThan(0);
    });

    it("should expose combined path /api/oauth/google/token when routes are mounted on app", () => {
      const testApp = express();
      testApp.use(routes);

      // Find the top-level routes layer where routes were mounted, then inspect
      // its nested routers. When you do `app.use(routes)` Express places a single
      // router on the app and the actual child routers are inside its `handle.stack`.
      const routesTopLayer = testApp._router?.stack?.find(
        (layer: any) => layer.name === "router" && layer.handle?.stack
      );
      const oauthLayer = routesTopLayer?.handle?.stack?.find(
        (layer: any) =>
          layer.name === "router" && layer.regexp?.source?.includes("oauth")
      );

      expect(oauthLayer).toBeDefined();

      // Clean the prefix like the debug route does
      const prefix = (oauthLayer?.regexp?.source || "")
        .replace("\\/?", "")
        .replace("(?=\\/|$)", "")
        .replace(/\\/g, "");
      const cleaned = prefix.replace(/\^|\$|\(|\)|\?=|\\/g, "");
      const base = (cleaned.startsWith("/") ? cleaned : "/" + cleaned).replace(
        /\/\//g,
        "/"
      );

      // Find the token route inside oauth router
      const postRoute = oauthGoogleRoutes.stack?.find(
        (l: any) => l.route?.path === "/google/token"
      );
      expect(postRoute).toBeDefined();

      // TS guard - now postRoute is defined
      const combined = `${base}${(postRoute as any).route.path}`.replace(
        /\/\//g,
        "/"
      );
      expect(combined).toBe("/api/oauth/google/token");
    });
  });
});
