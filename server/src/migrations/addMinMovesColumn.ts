import pool from '../config/database';

async function addMinMovesColumn() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE classic_puzzles
      ADD COLUMN IF NOT EXISTS min_moves INTEGER;
    `);
    console.log('✅ min_moves column added to classic_puzzles');
  } catch (err) {
    console.error('❌ Error adding min_moves column:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

addMinMovesColumn(); 