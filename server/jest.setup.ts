// jest.setup.ts
import { initializeDatabase } from './src/config/schema';
import pool from './src/config/database';

export default async function setup() {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  try {
    // Initialize database schema
    await initializeDatabase();
    
    // Clean up any existing test data
    await pool.query('DELETE FROM audit_log');
    await pool.query('DELETE FROM game_stats');
    await pool.query('DELETE FROM users');
    
    console.log('✅ Test setup completed');
  } catch (err) {
    console.error('❌ Test setup failed:', err);
    throw err;
  }
}

module.exports = setup; 