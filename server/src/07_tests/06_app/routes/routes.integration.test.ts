import request from "supertest";
import app from "../../../app";

describe("Route discovery and endpoints (integration)", () => {
  it("should discover oauth router and token route in routes module", async () => {
    // Inspect the routes module directly to ensure the oauth router is present
    // and contains the token route. This test doesn't rely on HTTP or Cloud Run.
    const oauthIdx =
      require("../../../05_frameworks/myexpress/routes/index").default;
    const oauthLayer = oauthIdx.stack?.find(
      (l: any) => l.name === "router" && l.regexp?.source?.includes("oauth")
    );

    expect(oauthLayer).toBeDefined();
    const tokenLayer = oauthLayer?.handle?.stack?.find(
      (l: any) => l.route?.path === "/google/token"
    );
    expect(tokenLayer).toBeDefined();
  });

  it("POST /api/oauth/google/token exists (should not return 404)", async () => {
    // Check at the router level to avoid testing external Google integration
    const routesTopLayer = app._router?.stack?.find(
      (l: any) => l.name === "router" && l.handle?.stack
    );

    const oauthRouterLayer = routesTopLayer?.handle?.stack?.find(
      (l: any) =>
        l.name === "router" && (l.regexp?.source || "").includes("oauth")
    );
    expect(oauthRouterLayer).toBeDefined();

    const tokenLayer = oauthRouterLayer?.handle?.stack?.find(
      (l: any) => l.route?.path === "/google/token"
    );
    expect(tokenLayer).toBeDefined();
    expect(tokenLayer?.route?.methods?.post).toBeTruthy();
  });
});
