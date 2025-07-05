#!/usr/bin/env node

/**
 * Stagehand Authentication Demo Script (Node.js Runtime)
 * 
 * This script demonstrates the automated user creation and authentication
 * testing capabilities using Stagehand AI-powered browser automation.
 * 
 * Note: Uses Node.js runtime as required by Stagehand/Playwright
 */

import { Stagehand } from '@browserbasehq/stagehand';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3008';

// Simple Stagehand config since we can't import from TypeScript config file in Node.js
const STAGEHAND_CONFIG = {
  env: 'LOCAL' as const,
  headless: false,
  verbose: 2,
  debugDom: true,
  modelName: 'gpt-4o' as const,
  modelClientOptions: {
    apiKey: process.env.OPENAI_API_KEY
  }
};

class StagehandAuthDemo {
  private stagehand: Stagehand;
  private demoUser = {
    email: `demo-user-${Date.now()}@stagehand-demo.test`,
    password: 'DemoPassword123!'
  };

  async initialize() {
    console.log('🚀 Initializing Stagehand Authentication Demo');
    console.log('📍 Demo URL:', BASE_URL);
    console.log('👀 Browser will be visible to demonstrate automation');
    
    this.stagehand = new Stagehand(STAGEHAND_CONFIG);
    
    await this.stagehand.init();
    console.log('✅ Stagehand initialized successfully');
  }

  async createTestUser() {
    console.log(`📧 Creating demo user: ${this.demoUser.email}`);
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${BASE_URL}/api/test-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-environment': 'true'
        },
        body: JSON.stringify(this.demoUser)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create test user: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Demo user created successfully:', result);
      
    } catch (error) {
      console.log('⚠️ Test user creation failed (continuing with existing user):', error.message);
    }
  }

  async demonstrateSignUp() {
    console.log('🔐 Demonstrating user sign-up flow');
    
    const page = this.stagehand.page;
    
    // Navigate to the application
    await page.goto(`${BASE_URL}/auth/signup`);
    
    // Fill in the sign-up form using Stagehand AI
    await this.stagehand.act({
      action: `Fill in the email field with "${this.demoUser.email}"`
    });
    
    await this.stagehand.act({
      action: `Fill in the password field with "${this.demoUser.password}"`
    });
    
    await this.stagehand.act({
      action: 'Click the sign up button'
    });
    
    // Wait for successful signup or error
    await page.waitForTimeout(3000);
    
    console.log('📸 Current page URL:', page.url());
    console.log('✅ Sign-up demonstration completed');
  }

  async demonstrateSignIn() {
    console.log('🚪 Demonstrating user sign-in flow');
    
    const page = this.stagehand.page;
    
    // Navigate to sign-in page
    await page.goto(`${BASE_URL}/auth/signin`);
    
    // Fill in the sign-in form
    await this.stagehand.act({
      action: `Fill in the email field with "${this.demoUser.email}"`
    });
    
    await this.stagehand.act({
      action: `Fill in the password field with "${this.demoUser.password}"`
    });
    
    await this.stagehand.act({
      action: 'Click the sign in button'
    });
    
    // Wait for navigation
    await page.waitForTimeout(3000);
    
    console.log('📸 Current page URL:', page.url());
    console.log('✅ Sign-in demonstration completed');
  }

  async demonstrateDashboard() {
    console.log('📊 Demonstrating dashboard interaction');
    
    const page = this.stagehand.page;
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'demo-dashboard.png' });
    
    console.log('📸 Dashboard screenshot saved: demo-dashboard.png');
    console.log('✅ Dashboard demonstration completed');
  }

  async cleanup() {
    console.log(`🧹 Cleaning up demo user: ${this.demoUser.email}`);
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${BASE_URL}/api/test-users`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-test-environment': 'true'
        },
        body: JSON.stringify({ email: this.demoUser.email })
      });
      
      if (response.ok) {
        console.log('✅ Demo user cleaned up successfully');
      } else {
        console.log('⚠️ Failed to clean up demo user');
      }
    } catch (error) {
      console.log('⚠️ Failed to clean up demo user');
    }
    
    if (this.stagehand) {
      await this.stagehand.close();
    }
  }
}

async function runFullDemo() {
  const demo = new StagehandAuthDemo();
  
  try {
    await demo.initialize();
    await demo.createTestUser();
    await demo.demonstrateSignUp();
    await demo.demonstrateSignIn();
    await demo.demonstrateDashboard();
    
    console.log('🎉 Demo completed successfully!');
    
  } catch (error) {
    console.error('💥 Demo failed:', error);
    throw error;
  } finally {
    await demo.cleanup();
  }
}

async function main() {
  console.log('🎬 Starting Stagehand Authentication Demo');
  console.log('🚀 Stagehand configured for LOCAL development environment');
  
  try {
    await runFullDemo();
  } catch (error) {
    console.error('💥 Fatal demo error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}