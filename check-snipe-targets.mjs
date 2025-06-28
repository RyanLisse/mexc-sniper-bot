/**
 * Check snipe targets in the database - Simple PostgreSQL check
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkSnipeTargets() {
  let client;
  
  try {
    // Use postgres package if available
    const postgres = await import('postgres');
    const sql = postgres.default(process.env.DATABASE_URL, {
      ssl: 'require',
      max: 1
    });

    console.log('🔍 Checking snipe targets in database...');
    
    // Check if table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'snipe_targets'
      );
    `;
    
    console.log('📋 Table exists:', tableCheck[0].exists);
    
    if (tableCheck[0].exists) {
      // Get all snipe targets
      const targets = await sql`
        SELECT id, symbol_name, status, confidence_score, priority, created_at, target_execution_time, error_message
        FROM snipe_targets 
        ORDER BY created_at DESC 
        LIMIT 10;
      `;
      
      console.log(`📊 Found ${targets.length} snipe targets:`);
      
      if (targets.length === 0) {
        console.log('❌ No snipe targets found in database');
        console.log('📝 This explains why no targets are being bought');
      } else {
        targets.forEach((target, index) => {
          console.log(`\n${index + 1}. Target ID: ${target.id}`);
          console.log(`   Symbol: ${target.symbol_name}`);
          console.log(`   Status: ${target.status}`);
          console.log(`   Confidence: ${target.confidence_score}`);
          console.log(`   Priority: ${target.priority}`);
          console.log(`   Created: ${target.created_at}`);
          console.log(`   Target Execution: ${target.target_execution_time || 'Immediate'}`);
          if (target.error_message) {
            console.log(`   ❌ Error: ${target.error_message}`);
          }
        });
        
        // Check specifically for ready targets
        const readyTargets = targets.filter(t => t.status === 'ready');
        console.log(`\n✅ Ready targets: ${readyTargets.length}`);
        
        // Check for low confidence targets
        const lowConfidenceTargets = targets.filter(t => t.confidence_score < 70);
        console.log(`⚠️  Low confidence targets (< 70): ${lowConfidenceTargets.length}`);
      }
    }
    
    await sql.end();
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    if (error.message.includes('postgres')) {
      console.log('📦 Installing postgres dependency...');
      
      // Try with simple connection check
      console.log('🔗 Attempting basic connection test...');
      console.log('DATABASE_URL configured:', !!process.env.DATABASE_URL);
      console.log('URL starts with postgresql:', process.env.DATABASE_URL?.startsWith('postgresql://'));
    }
  }
}

checkSnipeTargets();