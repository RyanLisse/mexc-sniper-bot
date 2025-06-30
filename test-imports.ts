// Simple script to test import resolution
try {
  console.log('Testing import: @/src/lib/cache/agent-response-cache');
  const agentCache = require('./src/lib/cache/agent-response-cache');
  console.log('✅ agent-response-cache imported successfully');
  
  console.log('Testing import: @/src/schemas/unified/mexc-api-schemas');
  const mexcSchemas = require('./src/schemas/unified/mexc-api-schemas');
  console.log('✅ mexc-api-schemas imported successfully');
  
  console.log('Testing import: @/src/lib/enhanced-unified-cache');
  const enhancedCache = require('./src/lib/enhanced-unified-cache');
  console.log('✅ enhanced-unified-cache imported successfully');
  
  console.log('Testing import: @/src/services/data/pattern-embedding-service');
  const patternService = require('./src/services/data/pattern-embedding-service');
  console.log('✅ pattern-embedding-service imported successfully');
  
  console.log('Testing import: @/src/lib/risk-calculation-modules');
  const riskModules = require('./src/lib/risk-calculation-modules');
  console.log('✅ risk-calculation-modules imported successfully');
  
  console.log('Testing import: @/src/services/trading/orchestrator/core-orchestrator');
  const coreOrchestrator = require('./src/services/trading/orchestrator/core-orchestrator');
  console.log('✅ core-orchestrator imported successfully');
  
  console.log('\n🎉 All imports successful!');
} catch (error) {
  console.error('❌ Import error:', error.message);
  process.exit(1);
}