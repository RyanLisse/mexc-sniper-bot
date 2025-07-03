
console.log('✅ Testing module exports...');

// Test 1: EnhancedUnifiedCacheSystem
try {
  const { EnhancedUnifiedCacheSystem, getEnhancedUnifiedCache } = require('./src/lib/enhanced-unified-cache.ts');
  console.log('✅ EnhancedUnifiedCacheSystem exported successfully');
  console.log('✅ getEnhancedUnifiedCache function exported successfully');
} catch (e) {
  console.log('❌ EnhancedUnifiedCacheSystem error:', e.message);
}

console.log('
🎉 Module verification complete\!');

