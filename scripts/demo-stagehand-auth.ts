#!/usr/bin/env bun

/**
 * Stagehand Authentication Demo Script
 * 
 * This script demonstrates the automated user creation and authentication
 * testing capabilities using Stagehand AI-powered browser automation.
 */

import { Stagehand } from '@browserbasehq/stagehand';
import StagehandConfig from '../stagehand.config.unified';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';

class StaghandAuthDemo {
  private stagehand: Stagehand;
  private demoUser = {
    email: `demo-user-${Date.now()}@stagehand-demo.test`,
    password: 'DemoPassword123!'
  };

  async initialize() {
    console.log('🚀 Initializing Stagehand Authentication Demo');
    
    this.stagehand = new Stagehand({
      ...StagehandConfig,
      // Demo configuration - visible browser for demonstration
      headless: false,
      verbose: 2,
      modelName: 'gpt-4o'
    });
    
    await this.stagehand.init();
    console.log('✅ Stagehand initialized successfully');
  }

  async createTestUser() {
    console.log(`📧 Creating demo user: ${this.demoUser.email}`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/test-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-environment': 'true'
        },
        body: JSON.stringify(this.demoUser)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Demo user created:', result);
      return result;
    } catch (error) {
      console.error('❌ Failed to create demo user:', error);
      throw error;
    }
  }

  async demonstrateAuthFlow() {
    console.log('🎭 Starting authentication flow demonstration');
    
    const page = this.stagehand.page;
    
    // Step 1: Navigate to application
    console.log('📍 Navigating to application home page');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Step 2: Find and click sign in button
    console.log('🔍 Looking for sign in button using AI');
    await page.act('Find and click the sign in or login button to access authentication');
    
    // Wait for auth page
    await page.waitForURL('**/auth', { timeout: 15000 });
    console.log('✅ Successfully navigated to authentication page');
    
    // Step 3: Fill authentication form using AI
    console.log('📝 Filling authentication form with AI assistance');
    await page.act(`Enter the email "${this.demoUser.email}" in the email input field`);
    await page.act(`Enter the password "${this.demoUser.password}" in the password input field`);
    
    // Step 4: Submit form
    console.log('🚀 Submitting authentication form');
    await page.act('Click the sign in or submit button to authenticate');
    
    // Step 5: Wait for successful authentication
    await page.waitForURL('**/dashboard', { timeout: 30000 });
    console.log('🎯 Successfully authenticated and reached dashboard');
    
    // Step 6: Demonstrate AI extraction of page data
    console.log('🧠 Using AI to extract page information');
    const pageData = await page.extract({
      instruction: 'Extract information about this dashboard page including any visible user information, navigation elements, and confirmation that login was successful',
      schema: {
        type: 'object',
        properties: {
          pageTitle: { type: 'string' },
          userLoggedIn: { type: 'boolean' },
          hasUserMenu: { type: 'boolean' },
          hasDashboardContent: { type: 'boolean' },
          userEmail: { type: 'string' }
        }
      }
    });
    
    console.log('📊 Extracted page data:', pageData);
    
    // Step 7: Test session persistence
    console.log('🔄 Testing session persistence with page refresh');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ Session persistence verified - still on dashboard after refresh');
    } else {
      console.warn('⚠️ Session may not have persisted - URL:', currentUrl);
    }
    
    // Step 8: Test sign out (optional)
    console.log('🚪 Testing sign out functionality');
    try {
      await page.act('Find and click the sign out or logout button');
      await page.waitForURL('**/auth', { timeout: 15000 });
      console.log('✅ Successfully signed out and returned to auth page');
    } catch (error) {
      console.log('⚠️ Sign out test skipped or failed:', error.message);
    }
  }

  async cleanupUser() {
    console.log(`🧹 Cleaning up demo user: ${this.demoUser.email}`);
    
    try {
      const response = await fetch(`${BASE_URL}/api/test-users?email=${encodeURIComponent(this.demoUser.email)}`, {
        method: 'DELETE',
        headers: {
          'x-test-environment': 'true'
        }
      });
      
      if (response.ok) {
        console.log('✅ Demo user cleaned up successfully');
      } else {
        console.warn('⚠️ Failed to clean up demo user');
      }
    } catch (error) {
      console.warn('⚠️ Cleanup error:', error.message);
    }
  }

  async close() {
    if (this.stagehand) {
      await this.stagehand.close();
      console.log('🏁 Stagehand demo completed');
    }
  }

  async runFullDemo() {
    try {
      await this.initialize();
      await this.createTestUser();
      await this.demonstrateAuthFlow();
    } catch (error) {
      console.error('💥 Demo failed:', error);
    } finally {
      await this.cleanupUser();
      await this.close();
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Stagehand Authentication Demo

This script demonstrates automated user creation and authentication testing
using Stagehand's AI-powered browser automation.

Usage: bun run scripts/demo-stagehand-auth.ts

Environment Variables:
  TEST_BASE_URL          Base URL for demo (default: http://localhost:3008)
  OPENAI_API_KEY         OpenAI API key for Stagehand AI features
  SUPABASE_URL           Supabase project URL
  SUPABASE_ANON_KEY      Supabase anonymous key

The demo will:
1. Create a temporary test user via API
2. Use AI to navigate and fill authentication forms
3. Verify successful login and dashboard access
4. Test session persistence
5. Demonstrate sign out functionality
6. Clean up the test user

Note: This demo runs with a visible browser window to show the automation in action.
    `);
    return;
  }
  
  console.log('🎬 Starting Stagehand Authentication Demo');
  console.log(`📍 Demo URL: ${BASE_URL}`);
  console.log('👀 Browser will be visible to demonstrate automation\n');
  
  const demo = new StaghandAuthDemo();
  await demo.runFullDemo();
}

// Handle interruption gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Demo interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Demo terminated');
  process.exit(0);
});

// Run the demo
main().catch((error) => {
  console.error('💥 Fatal demo error:', error);
  process.exit(1);
});