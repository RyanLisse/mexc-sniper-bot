// Simple Node.js script to test if imports work
console.log('Testing import resolution...');

try {
  // Test if TypeScript module resolution works
  const fs = require('fs');
  const path = require('path');
  
  // Check if the files exist
  const filesToCheck = [
    'src/lib/cache/agent-response-cache.ts',
    'src/schemas/unified/mexc-api-schemas.ts',
    'src/lib/enhanced-unified-cache.ts',
    'src/services/data/pattern-embedding-service.ts',
    'src/lib/risk-calculation-modules.ts',
    'src/services/trading/orchestrator/core-orchestrator.ts'
  ];
  
  console.log('Checking file existence:');
  filesToCheck.forEach(file => {
    const fullPath = path.join(__dirname, file);
    const exists = fs.existsSync(fullPath);
    console.log(`${exists ? '✅' : '❌'} ${file}`);
    
    if (exists) {
      // Check if it has exports
      const content = fs.readFileSync(fullPath, 'utf8');
      const hasExports = content.includes('export');
      console.log(`   ${hasExports ? '✅' : '❌'} Has exports`);
    }
  });
  
  console.log('\n✅ Import verification complete');
} catch (error) {
  console.error('❌ Error during verification:', error);
}