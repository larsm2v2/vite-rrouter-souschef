import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // bind to all addresses so both IPv4 and IPv6 localhost work (prevents "refused to connect" when
    // the dev server listens only on IPv6 ::1 but browser uses 127.0.0.1)
    host: true,
    port: 5173,
    // Proxy API and auth routes to the backend while running in dev so cookies
    // appear to be same-origin and cross-site cookie issues don't prevent
    // refresh rotation. This keeps local development close to production.
    proxy: {
      // API endpoints, including /auth/refresh and other auth routes
      "/auth": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        secure: false,
      },
      // Optional microservice proxy for clean-recipe-service path
      "/clean-recipe": {
        target: "http://localhost:6000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
