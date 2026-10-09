const { Pool } = require('pg');
require('dotenv').config();

// Neon requires SSL. The pg driver reads DATABASE_URL directly.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;
