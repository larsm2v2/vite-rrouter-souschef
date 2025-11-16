export { default as app } from "./app";
// Import the folder index explicitly to avoid accidental import of ./routes.ts
// which exists for legacy usage. This ensures the main routes in
// `./routes/index.ts` are used in production.
export { default as routes } from "./routes/index";
export * from "./middleware";
export const test = "Express module loaded!";
