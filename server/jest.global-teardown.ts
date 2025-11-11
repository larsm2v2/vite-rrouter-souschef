// jest.global-teardown.ts
import pool from "./src/05_frameworks/database/connection";

export default async () => {
  try {
    // First clean up any test data
    await pool.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recipes') THEN
          TRUNCATE recipes CASCADE;
        END IF;
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
          TRUNCATE users CASCADE;
        END IF;
      END $$;
    `);

    console.log("✅ Test data cleaned up");
  } catch (err) {
    console.error("❌ Cleanup error:", err);
  } finally {
    try {
      // Properly await the end method
      console.log("Closing connection pool...");
      await pool.end();
      console.log("✅ Connection pool closed");
    } catch (err) {
      console.error("❌ Error closing connection pool:", err);
    }
  }
};
