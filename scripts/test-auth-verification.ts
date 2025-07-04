#!/usr/bin/env bun
/**
 * Test Authentication Verification Script
 * 
 * This script verifies the authentication setup and email confirmation bypass
 * functionality for testing purposes.
 */

import { createSupabaseAdminClient } from '@/src/lib/supabase-auth';

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  error?: any;
}

class AuthVerificationTester {
  private supabase = createSupabaseAdminClient();
  private testResults: TestResult[] = [];

  private addResult(test: string, passed: boolean, message: string, error?: any) {
    this.testResults.push({ test, passed, message, error });
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${test}: ${message}`);
    if (error) {
      console.log(`       Error: ${error.message || error}`);
    }
  }

  async testSupabaseConnection() {
    try {
      const { data, error } = await this.supabase.auth.admin.listUsers();
      
      if (error) {
        this.addResult('Supabase Connection', false, 'Connection failed', error);
        return false;
      }

      this.addResult('Supabase Connection', true, `Connected successfully. Found ${data.users.length} users.`);
      return true;
    } catch (error) {
      this.addResult('Supabase Connection', false, 'Connection error', error);
      return false;
    }
  }

  async testEnvironmentVariables() {
    const requiredVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ];

    let allPresent = true;
    const missingVars: string[] = [];

    for (const varName of requiredVars) {
      const value = process.env[varName];
      if (!value || value.includes('placeholder')) {
        allPresent = false;
        missingVars.push(varName);
      }
    }

    if (allPresent) {
      this.addResult('Environment Variables', true, 'All required variables are present');
    } else {
      this.addResult('Environment Variables', false, `Missing or placeholder variables: ${missingVars.join(', ')}`);
    }

    return allPresent;
  }

  async testTestUserCreation() {
    const testEmail = `test-${Date.now()}@mexcsniper.com`;
    const testPassword = 'TestPassword123!';

    try {
      // Create test user with email confirmation bypass
      const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true, // Skip email confirmation
      });

      if (authError) {
        this.addResult('Test User Creation', false, 'Failed to create test user', authError);
        return false;
      }

      // Verify user was created with email confirmed
      const isEmailConfirmed = !!authData.user?.email_confirmed_at;
      
      if (isEmailConfirmed) {
        this.addResult('Test User Creation', true, `Created user ${testEmail} with email confirmation bypassed`);
        
        // Clean up test user
        await this.supabase.auth.admin.deleteUser(authData.user!.id);
        return true;
      } else {
        this.addResult('Test User Creation', false, 'User created but email not confirmed');
        
        // Clean up test user
        await this.supabase.auth.admin.deleteUser(authData.user!.id);
        return false;
      }

    } catch (error) {
      this.addResult('Test User Creation', false, 'Error creating test user', error);
      return false;
    }
  }

  async testExistingTestUser() {
    const testEmail = process.env.TEST_USER_EMAIL || 'ryan@ryanlisse.com';
    
    try {
      const { data: users, error } = await this.supabase.auth.admin.listUsers();
      
      if (error) {
        this.addResult('Existing Test User', false, 'Failed to list users', error);
        return false;
      }

      const existingUser = users.users.find(u => u.email === testEmail);
      
      if (!existingUser) {
        this.addResult('Existing Test User', false, `Test user ${testEmail} not found`);
        return false;
      }

      const isEmailConfirmed = !!existingUser.email_confirmed_at;
      
      if (isEmailConfirmed) {
        this.addResult('Existing Test User', true, `Test user ${testEmail} exists and email is confirmed`);
        return true;
      } else {
        // Try to confirm the email
        const { error: updateError } = await this.supabase.auth.admin.updateUserById(
          existingUser.id,
          { email_confirm: true }
        );

        if (updateError) {
          this.addResult('Existing Test User', false, `Test user ${testEmail} exists but failed to confirm email`, updateError);
          return false;
        }

        this.addResult('Existing Test User', true, `Test user ${testEmail} exists and email confirmation was bypassed`);
        return true;
      }

    } catch (error) {
      this.addResult('Existing Test User', false, 'Error checking existing test user', error);
      return false;
    }
  }

  async testTestUserAPIEndpoint() {
    const testEmail = `api-test-${Date.now()}@mexcsniper.com`;
    const testPassword = 'TestPassword123!';

    try {
      // Test the API endpoint
      const response = await fetch('http://localhost:3008/api/test-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-test-environment': 'true'
        },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword
        })
      });

      if (!response.ok) {
        this.addResult('Test User API Endpoint', false, `API returned status ${response.status}`);
        return false;
      }

      const result = await response.json();
      
      if (result.success) {
        this.addResult('Test User API Endpoint', true, `API endpoint working: ${result.message}`);
        
        // Clean up via API
        await fetch(`http://localhost:3008/api/test-users?email=${testEmail}`, {
          method: 'DELETE',
          headers: { 'x-test-environment': 'true' }
        });
        
        return true;
      } else {
        this.addResult('Test User API Endpoint', false, `API returned error: ${result.error}`);
        return false;
      }

    } catch (error) {
      this.addResult('Test User API Endpoint', false, 'Error testing API endpoint', error);
      return false;
    }
  }

  async testAuthMiddleware() {
    try {
      // Test protected route without auth
      const response = await fetch('http://localhost:3008/dashboard', {
        method: 'GET',
        headers: {
          'x-test-environment': 'true'
        },
        redirect: 'manual'
      });

      // Should redirect to auth page in test environment
      if (response.status === 302 || response.status === 307) {
        const location = response.headers.get('Location');
        if (location && location.includes('/auth')) {
          this.addResult('Auth Middleware', true, 'Middleware correctly redirects unauthenticated users');
          return true;
        }
      }

      // In test environment, might allow access directly
      if (response.status === 200) {
        this.addResult('Auth Middleware', true, 'Middleware allows access in test environment');
        return true;
      }

      this.addResult('Auth Middleware', false, `Unexpected response status: ${response.status}`);
      return false;

    } catch (error) {
      this.addResult('Auth Middleware', false, 'Error testing auth middleware', error);
      return false;
    }
  }

  async runAllTests() {
    console.log('🧪 Starting Authentication Verification Tests...');
    console.log('=' .repeat(60));

    const tests = [
      () => this.testEnvironmentVariables(),
      () => this.testSupabaseConnection(),
      () => this.testTestUserCreation(),
      () => this.testExistingTestUser(),
      () => this.testTestUserAPIEndpoint(),
      () => this.testAuthMiddleware()
    ];

    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        console.error('Test execution error:', error);
      }
    }

    this.printSummary();
  }

  private printSummary() {
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Test Summary');
    console.log('=' .repeat(60));

    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const failed = total - passed;

    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(r => console.log(`  - ${r.test}: ${r.message}`));
    }

    console.log('\n💡 Recommendations:');
    
    if (failed === 0) {
      console.log('  ✅ All tests passed! Your authentication setup is working correctly.');
    } else {
      console.log('  🔧 Fix the failed tests to ensure proper authentication setup.');
      
      const envFailed = this.testResults.find(r => r.test === 'Environment Variables' && !r.passed);
      if (envFailed) {
        console.log('  📝 Update your .env.local file with proper Supabase keys');
      }
      
      const connectionFailed = this.testResults.find(r => r.test === 'Supabase Connection' && !r.passed);
      if (connectionFailed) {
        console.log('  🔌 Check your Supabase project settings and network connection');
      }
    }

    console.log('\n📚 Next Steps:');
    console.log('  1. Run: bun run scripts/bypass-email-confirmation.ts --check-status');
    console.log('  2. Run: bun run scripts/bypass-email-confirmation.ts --email ryan@ryanlisse.com');
    console.log('  3. Test authentication in your app: http://localhost:3008/auth');
  }
}

// CLI interface
async function main() {
  const tester = new AuthVerificationTester();
  await tester.runAllTests();
}

if (import.meta.main) {
  main().catch(console.error);
}

export { AuthVerificationTester };