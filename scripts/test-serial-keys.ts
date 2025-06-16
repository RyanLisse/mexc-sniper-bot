#!/usr/bin/env npx tsx

/**
 * Test Serial Primary Keys
 * Quick test to see if serial primary keys are working in PostgreSQL
 */

import { config } from "dotenv";
import { resolve } from "path";
import postgres from "postgres";
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const databaseUrl = process.env.DATABASE_URL?.startsWith('postgresql://') 
  ? process.env.DATABASE_URL 
  : 'postgresql://neondb_owner:npg_oTv5qIQYX6lb@ep-silent-firefly-a1l3mkrm-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function testSerialKeys() {
  console.log('🧪 Testing PostgreSQL Serial Primary Keys');
  console.log('==========================================');
  
  const client = postgres(databaseUrl, {
    max: 1,
    ssl: 'require'
  });

  const db = drizzle(client, { schema });

  try {
    // Check if transactions table exists
    const tables = await client`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'transactions'
    `;
    
    if (tables.length === 0) {
      console.log('❌ Transactions table does not exist');
      return;
    }
    
    console.log('✅ Transactions table exists');
    
    // Check the structure of the transactions table
    const columns = await client`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'transactions'
      AND column_name = 'id'
    `;
    
    if (columns.length > 0) {
      const idColumn = columns[0];
      console.log('📋 ID column structure:');
      console.log('  - Type:', idColumn.data_type);
      console.log('  - Default:', idColumn.column_default);
      console.log('  - Nullable:', idColumn.is_nullable);
      
      if (idColumn.column_default && idColumn.column_default.includes('nextval')) {
        console.log('✅ ID column has auto-increment (serial) setup');
      } else {
        console.log('❌ ID column does NOT have auto-increment setup');
      }
    }
    
    // Test creating a user first (required for foreign key)
    console.log('\n🔧 Testing user creation...');
    const [testUser] = await db.insert(schema.user).values({
      id: 'test-serial-user',
      name: 'Test User',
      email: 'test-serial@example.com',
      emailVerified: false,
    }).returning();
    
    console.log('✅ User created:', testUser.id);
    
    // Test creating a transaction without specifying ID
    console.log('\n🔧 Testing transaction creation (auto-increment)...');
    try {
      const [transaction] = await db.insert(schema.transactions).values({
        userId: testUser.id,
        transactionType: 'buy',
        symbolName: 'TESTUSDT',
        status: 'completed'
      }).returning();
      
      console.log('✅ Transaction created with auto ID:', transaction.id);
      console.log('✅ Serial primary key is working!');
      
      // Clean up
      await db.delete(schema.transactions).where(schema.transactions.id.eq(transaction.id));
      await db.delete(schema.user).where(schema.user.id.eq(testUser.id));
      console.log('✅ Test data cleaned up');
      
    } catch (error) {
      console.error('❌ Transaction creation failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.end();
  }
}

async function main() {
  await testSerialKeys();
}

if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}