import pool from "../config/database";

/**
 * Migration script to update difficulty values for classic puzzles
 */

// Force use of the production environment values
process.env.NODE_ENV = 'development';

async function updateDifficulties() {
  const client = await pool.connect();
  
  try {
    console.log("Starting difficulty update process...");
    await client.query('BEGIN');
    
    // First check if classic_puzzles table exists
    const { rows: tableCheck } = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'classic_puzzles'
      );
    `);
    
    if (!tableCheck[0].exists) {
      console.log("classic_puzzles table doesn't exist, nothing to update");
      await client.query('ROLLBACK');
      return;
    }
    
    // Since difficulty is NOT NULL, we need to update to empty string instead of NULL
    console.log("Updating difficulty values for classic puzzles...");
    const { rowCount } = await client.query(`
      UPDATE classic_puzzles
      SET difficulty = ''
      WHERE difficulty = 'classic'
    `);
    
    console.log(`Updated difficulty for ${rowCount} puzzles from 'classic' to empty string`);

    await client.query('COMMIT');
    console.log("Difficulty update completed successfully");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating difficulties:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  updateDifficulties()
    .then(() => {
      console.log('Difficulty update completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('Difficulty update failed:', err);
      process.exit(1);
    });
}

export default updateDifficulties; 