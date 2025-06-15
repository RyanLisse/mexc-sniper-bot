import { globalEnhancedAgentCache } from './src/lib/enhanced-agent-cache';
import { globalCacheManager } from './src/lib/cache-manager';

async function debugCache() {
  console.log('=== Enhanced Cache Debug Test ===');

  // Clear cache first
  await globalCacheManager.clear();

  // Test real agent cache scenario
  const input = 'Check MEXC symbols for ready state patterns';
  const agentId = 'pattern-discovery-agent';
  const context = { agent: agentId };

  // Simulate setting an agent response like the real code does
  const mockResponse = {
    content: 'Mock pattern analysis result',
    metadata: {
      agent: agentId,
      timestamp: new Date().toISOString(),
      fromCache: false
    }
  };

  console.log('1. Setting agent response...');
  await globalEnhancedAgentCache.setAgentResponse(
    agentId,
    input,
    mockResponse,
    context,
    {
      dependencies: ['mexc/symbols'],
      priority: 'high'
    }
  );

  console.log('2. Getting agent response...');
  const cachedResponse = await globalEnhancedAgentCache.getAgentResponse(agentId, input, context);
  console.log('   Got cached response:', cachedResponse ? 'YES' : 'NO');

  console.log('3. Current cache keys:', globalCacheManager.getCacheKeys().length);

  console.log('4. Invalidating by dependency mexc/symbols...');
  const invalidated = await globalEnhancedAgentCache.invalidateAgentResponses({
    dependencies: ['mexc/symbols']
  });
  console.log('   Invalidated count:', invalidated);

  console.log('5. Getting agent response after invalidation...');
  const afterInvalidation = await globalEnhancedAgentCache.getAgentResponse(agentId, input, context);
  console.log('   Got cached response after invalidation:', afterInvalidation ? 'YES' : 'NO');

  console.log('6. Cache keys after invalidation:', globalCacheManager.getCacheKeys().length);
}

debugCache().catch(console.error);