import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testConnection() {
  try {
    console.log('Testing TursoDB connection...');
    const result = await client.execute('SELECT 1 as test');
    console.log('Connection successful:', result);
    
    // Check if tables exist
    const tables = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    console.log('Existing tables:', tables.rows);
    
  } catch (error) {
    console.error('Connection failed:', error);
  } finally {
    client.close();
  }
}

testConnection();
EOF < /dev/null