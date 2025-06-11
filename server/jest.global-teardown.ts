// jest.global-teardown.ts
import pool from "./src/config/database";

export default async () => {
  try {
    // Try to clean up tables if they exist
    await pool.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_log') THEN
          TRUNCATE audit_log CASCADE;
        END IF;
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'game_stats') THEN
          TRUNCATE game_stats CASCADE;
        END IF;
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
          TRUNCATE users CASCADE;
        END IF;
      END $$;
    `);
  } catch (err) {
    console.error('Cleanup error:', err);
  } finally {
    await pool.end();
    // Add delay for connection cleanup
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};
