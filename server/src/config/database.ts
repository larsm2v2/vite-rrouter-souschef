// Backwards-compatibility shim: re-export the new framework connection
// This keeps existing imports working while the old src/config folder is removed.
import conn from "../05_frameworks/database/connection";
export default conn;
