import pool from '../config/database';

describe('Database Schema', () => {
  beforeAll(async () => {
    // Drop tables in correct order to handle dependencies
    await pool.query('DROP TABLE IF EXISTS audit_log');
    await pool.query('DROP TABLE IF EXISTS game_stats');
    await pool.query('DROP TABLE IF EXISTS users');

    // Create tables in correct order
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_sub TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL CHECK (length(action) <= 50),
        endpoint TEXT NOT NULL CHECK (length(endpoint) <= 255),
        ip_address TEXT NOT NULL CHECK (length(ip_address) <= 45),
        user_agent TEXT CHECK (length(user_agent) <= 512),
        status_code INTEGER CHECK (status_code BETWEEN 100 AND 599),
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT NOW()
      );
    `);
  });

  it('should allow null user_id in audit_log', async () => {
    // Test inserting a record with null user_id
    const result = await pool.query(`
      INSERT INTO audit_log (
        user_id, action, endpoint, ip_address, 
        user_agent, status_code, metadata
      ) VALUES (
        NULL, 'GET', '/test', '127.0.0.1',
        'test-agent', 200, '{"test": true}'
      ) RETURNING id;
    `);
    
    expect(result.rows[0].id).toBeDefined();
    
    // Clean up
    await pool.query('DELETE FROM audit_log WHERE id = $1', [result.rows[0].id]);
  });

  afterAll(async () => {
    // Drop tables in correct order
    await pool.query('DROP TABLE IF EXISTS audit_log');
    await pool.query('DROP TABLE IF EXISTS users');
    await pool.end();
  });
}); 