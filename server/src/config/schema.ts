// Compatibility shim for schema — forward to new framework schema implementation
import { initializeDatabase } from "../05_frameworks/database/schema";

export { initializeDatabase };

export default initializeDatabase;
