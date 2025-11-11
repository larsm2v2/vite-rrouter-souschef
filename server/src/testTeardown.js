// Global teardown for Jest: attempt to clean up database connections safely.
/* eslint-disable @typescript-eslint/no-var-requires */
module.exports = async () => {
  // Try to require the default-export DB wrapper at the new framework location
  try {
    const maybeDbWrapper = require("./05_frameworks/database/connection");
    const dbWrapper =
      maybeDbWrapper && maybeDbWrapper.default
        ? maybeDbWrapper.default
        : maybeDbWrapper;

    if (dbWrapper && typeof dbWrapper.end === "function") {
      await dbWrapper.end();
    }
  } catch (err) {
    // Not fatal — continue to try other cleanups
  }

  // Fallback: also try the named pool from 05_frameworks/database/connection
  try {
    const conn = require("./05_frameworks/database/connection");
    const pool = conn && conn.pool ? conn.pool : null;
    if (pool && typeof pool.end === "function") {
      await pool.end();
      // console.log('Global teardown: connection.pool.end() called');
    }
  } catch (err) {
    // ignore
  }

  // Give Node a short moment to let sockets/TCP handles settle.
  // This sometimes helps with lingering TCPWRAP warnings in Jest runs.
  // Extra attempt: if internal client arrays exist, try to force-close them.
  try {
    const conn2 = require("./05_frameworks/database/connection");
    const pool2 = conn2 && conn2.pool ? conn2.pool : null;
    if (pool2) {
      // Accessing internal fields is fragile but sometimes helps in tests
      const clients = pool2._clients || pool2.clients || null;
      if (clients && Array.isArray(clients)) {
        for (const c of clients) {
          try {
            if (c && typeof c.release === "function") {
              c.release();
            }
            if (c && typeof c.end === "function") {
              c.end();
            }
          } catch (e) {
            // ignore individual client errors
          }
        }
      }
    }
  } catch (err) {
    // ignore
  }

  try {
    // Wait a bit longer to allow sockets to close
    await new Promise((res) => setTimeout(res, 350));
  } catch (err) {
    // ignore
  }
};
