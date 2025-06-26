#!/usr/bin/env node

/**
 * Test MEXC Connectivity Method
 * Converted from JavaScript to TypeScript for type safety
 */

interface ConnectivityResult {
  success: boolean;
  data?: {
    latency: number;
    serverTime: number;
    [key: string]: any;
  };
  error?: string;
}

interface MexcService {
  hasValidCredentials(): boolean;
  testConnectivityWithResponse(): Promise<ConnectivityResult>;
}

console.log('🔍 Testing MEXC Connectivity Method...');

try {
  const { getRecommendedMexcService } = await import('./src/services/api/mexc-unified-exports.ts') as {
    getRecommendedMexcService(): MexcService;
  };
  
  const mexcService = getRecommendedMexcService();
  
  console.log('✅ Service initialized');
  
  const hasCredentials: boolean = mexcService.hasValidCredentials();
  console.log(`📋 Has credentials: ${hasCredentials}`);
  
  if (hasCredentials) {
    console.log('🔍 Testing connectivity method...');
    const result: ConnectivityResult = await mexcService.testConnectivityWithResponse();
    
    console.log('📊 Connectivity result:', {
      success: result.success,
      hasData: !!result.data,
      error: result.error,
      dataKeys: result.data ? Object.keys(result.data) : []
    });
    
    if (result.success && result.data) {
      console.log('✅ Connectivity test passed');
      console.log(`⏱️ Latency: ${result.data.latency}ms`);
      console.log(`⏰ Server time: ${new Date(result.data.serverTime).toISOString()}`);
    } else {
      console.log('❌ Connectivity test failed:', result.error);
    }
  }
  
} catch (error) {
  const err = error as Error;
  console.error('💥 Test failed:', err.message);
  console.error('Stack:', err.stack);
}