import request from "supertest";
import { app } from "../../05_frameworks/index";

/**
 * Ensures that a route is mounted on the app.
 * Throws an error if the route is missing.
 */
export async function assertRouteExists(path: string, method: string = "post") {
  const debug = await request(app).get("/debug/routes");

  let routes: any[] | null = null;

  if (debug.status === 200 && Array.isArray(debug.body.routes)) {
    routes = debug.body.routes;
  } else {
    // Fallback: if the test harness doesn't mount the server debug endpoints,
    // introspect the app._router stack directly (this mirrors /debug/routes).
    const stack: any[] = (app as any)._router?.stack || [];
    const built: any[] = [];

    function walk(stack: any[], basePath = "") {
      stack.forEach((layer: any) => {
        try {
          if (layer.route) {
            built.push({
              path: basePath + (layer.route.path || ""),
              methods: Object.keys(layer.route.methods || {}),
            });
          } else if (
            layer.name === "router" &&
            layer.handle &&
            layer.handle.stack
          ) {
            const prefix = layer.regexp?.source
              ? layer.regexp.source
                  .replace("\\/?", "")
                  .replace("(?=\\/|$)", "")
                  .replace(/\\/g, "")
              : "";
            const cleaned = prefix.replace(/\^|\$|\(|\)|\?=|\\/g, "");
            const newBase = (basePath + cleaned).replace(/\/\//g, "/");
            walk(layer.handle.stack, newBase);
          }
        } catch (ignore) {
          // Ignore odd / non-standard layers
        }
      });
    }

    walk(stack);
    routes = built;
  }

  const normalizedMethod = (method || "post").toLowerCase();

  const found = (routes || []).some((r: any) => {
    const hasPath = r.path === path;
    const methods = (r.methods || []).map((m: string) => m.toLowerCase());
    const hasMethod = methods.includes(normalizedMethod);
    return hasPath && hasMethod;
  });

  if (!found) {
    // Provide helpful debugging information in the error
    const available = (routes || [])
      .map((r: any) => `${(r.methods || []).join(",")} ${r.path}`)
      .slice(0, 200)
      .join(" | ");
    try {
      const modules = await request(app).get("/debug/imported-modules");
      const imported = modules.body?.modules || [];
      const importedMsg = imported
        .map((m: string) => m.split("/routes/").pop() || m)
        .slice(0, 50)
        .join(", ");
      throw new Error(
        `Expected route ${method.toUpperCase()} ${path} to exist, but it was not found in /debug/routes. Available routes: ${available}\nImported route modules: ${importedMsg}`
      );
    } catch (err) {
      throw new Error(
        `Expected route ${method.toUpperCase()} ${path} to exist, but it was not found in /debug/routes. Available routes: ${available}`
      );
    }
    throw new Error(
      `Expected route ${method.toUpperCase()} ${path} to exist, but it was not found in /debug/routes. Available routes: ${available}`
    );
  }
}
