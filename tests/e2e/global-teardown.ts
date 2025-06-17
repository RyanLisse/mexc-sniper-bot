/**
 * Playwright Global Teardown
 * 
 * Runs once after all tests to clean up the testing environment
 * and generate final reports.
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for authentication E2E tests...');
  
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:3008';
  const testEnvironment = process.env.TEST_ENVIRONMENT || 'test';
  
  try {
    // Generate test summary
    console.log('📊 Generating test summary...');
    
    const testSummary = {
      environment: testEnvironment,
      baseURL: baseURL,
      timestamp: new Date().toISOString(),
      testRun: {
        completed: true,
        duration: process.uptime(),
      }
    };
    
    // Ensure the reports directory exists
    const reportsDir = path.join(process.cwd(), 'playwright-report');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Write test summary
    const summaryPath = path.join(reportsDir, 'test-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(testSummary, null, 2));
    
    console.log(`📝 Test summary written to: ${summaryPath}`);
    
    // Final health check to verify system state
    console.log('🏥 Performing final health check...');
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      const healthResponse = await page.request.get(`${baseURL}/api/health/auth`);
      
      if (healthResponse.status() === 200) {
        const healthData = await healthResponse.json();
        console.log(`✅ Final health check: ${healthData.status}`);
        
        // Add health data to summary
        testSummary.finalHealthCheck = {
          status: healthData.status,
          authConfigured: healthData.auth_configured,
          kindeSDKStatus: healthData.kinde_sdk_status,
          timestamp: new Date().toISOString()
        };
        
        // Update summary file
        fs.writeFileSync(summaryPath, JSON.stringify(testSummary, null, 2));
      } else {
        console.warn(`⚠️ Final health check failed: ${healthResponse.status()}`);
      }
    } catch (error) {
      console.warn('⚠️ Could not perform final health check:', error.message);
    } finally {
      await browser.close();
    }
    
    // Environment-specific cleanup
    if (testEnvironment === 'test') {
      console.log('🧪 Running test environment cleanup...');
      
      // Test environment cleanup (e.g., clear test data)
      // This would integrate with your test user cleanup systems
    }
    
    // Generate deployment validation report for CI
    if (process.env.CI === 'true') {
      console.log('🚀 Generating deployment validation report...');
      
      const validationReport = {
        deployment: {
          environment: testEnvironment,
          url: baseURL,
          timestamp: new Date().toISOString(),
          status: 'completed'
        },
        tests: {
          completed: true,
          environment: testEnvironment
        },
        health: testSummary.finalHealthCheck || { status: 'unknown' }
      };
      
      const reportPath = path.join(reportsDir, 'deployment-validation.json');
      fs.writeFileSync(reportPath, JSON.stringify(validationReport, null, 2));
      
      console.log(`🚀 Deployment validation report: ${reportPath}`);
    }
    
    console.log('✅ Global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown to avoid masking test failures
  }
}

export default globalTeardown;