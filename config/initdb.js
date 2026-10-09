// Run with: npm run initdb
// Reads schema.sql and executes it against your Neon database.
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql')).toString();
  try {
    console.log('Connecting to database...');
    await pool.query(sql);
    console.log('✅ Tables created successfully (or already existed).');
  } catch (err) {
    console.error('❌ Failed to initialize database:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

init();
