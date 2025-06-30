// Test ES module imports
try {
  console.log('Testing ES module imports...');
  
  // Test relative import
  const { AgentResponseCache } = await import('./src/lib/cache/agent-response-cache.ts');
  console.log('✅ AgentResponseCache imported successfully');
  
  // Test other imports
  const mexcSchemas = await import('./src/schemas/unified/mexc-api-schemas.ts');
  console.log('✅ MEXC API schemas imported successfully');
  
  const enhancedCache = await import('./src/lib/enhanced-unified-cache.ts');
  console.log('✅ Enhanced unified cache imported successfully');
  
  const patternEmbedding = await import('./src/services/data/pattern-embedding-service.ts');
  console.log('✅ Pattern embedding service imported successfully');
  
  const riskModules = await import('./src/lib/risk-calculation-modules.ts');
  console.log('✅ Risk calculation modules imported successfully');
  
  const coreOrchestrator = await import('./src/services/trading/orchestrator/core-orchestrator.ts');
  console.log('✅ Core orchestrator imported successfully');
  
  console.log('\n🎉 All imports working correctly!');
  
} catch (error) {
  console.error('❌ Import error:', error.message);
  console.error('Full error:', error);
}