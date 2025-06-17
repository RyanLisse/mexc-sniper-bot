/**
 * Playwright Global Setup
 * 
 * Runs once before all tests to prepare the testing environment
 * for authentication flow validation.
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for authentication E2E tests...');
  
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3008';
  const testEnvironment = process.env.TEST_ENVIRONMENT || 'test';
  
  console.log(`📍 Base URL: ${baseURL}`);
  console.log(`🌍 Test Environment: ${testEnvironment}`);
  
  // Launch a browser to verify basic connectivity
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('🔍 Verifying application accessibility...');
    
    // Check if the application is accessible
    const response = await page.goto(baseURL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    if (!response || response.status() >= 400) {
      throw new Error(`Application not accessible: ${response?.status()}`);
    }
    
    console.log('✅ Application is accessible');
    
    // Verify auth health endpoint
    console.log('🏥 Checking auth health endpoint...');
    
    const healthResponse = await page.request.get('/api/health/auth');
    
    if (healthResponse.status() !== 200) {
      console.warn(`⚠️ Auth health endpoint returned: ${healthResponse.status()}`);
    } else {
      const healthData = await healthResponse.json();
      console.log(`✅ Auth health status: ${healthData.status}`);
      console.log(`🔧 Auth configured: ${healthData.auth_configured}`);
      console.log(`📡 Kinde SDK status: ${healthData.kinde_sdk_status}`);
    }
    
    // Environment-specific setup
    if (testEnvironment === 'test') {
      console.log('🧪 Running test environment setup...');
      
      // Verify test environment configuration
      const healthData = await healthResponse.json();
      if (healthData.deployment_info?.environment !== 'test') {
        console.warn('⚠️ Environment mismatch detected');
      }
    }
    
    if (testEnvironment === 'staging') {
      console.log('🎭 Running staging environment setup...');
      
      // Additional staging-specific checks could go here
    }
    
    if (testEnvironment === 'production') {
      console.log('🏭 Running production environment setup...');
      
      // Verify HTTPS enforcement
      if (!baseURL.startsWith('https://')) {
        throw new Error('Production environment must use HTTPS');
      }
    }
    
    console.log('✅ Global setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;