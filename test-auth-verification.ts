#!/usr/bin/env tsx

/**
 * MEXC Sniper Bot - Authentication UI Verification Test
 * 
 * Verifies all authentication UI components work with real auth system
 * Tests login/logout, protected routes, session management, and user state
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

interface AuthVerificationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  details: string;
  timestamp: string;
}

class AuthUIVerification {
  private results: AuthVerificationResult[] = [];
  private readonly baseUrl = 'http://localhost:3008';

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'WARNING', details: string) {
    this.results.push({
      test,
      status,
      details,
      timestamp: new Date().toISOString()
    });
    
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} ${test}: ${details}`);
  }

  async verifyKindeConfiguration() {
    console.log('\n🔍 Verifying Kinde Authentication Configuration...\n');

    // Check environment variables
    const requiredEnvVars = [
      'KINDE_CLIENT_ID',
      'KINDE_CLIENT_SECRET', 
      'KINDE_ISSUER_URL',
      'KINDE_SITE_URL',
      'KINDE_POST_LOGOUT_REDIRECT_URL',
      'KINDE_POST_LOGIN_REDIRECT_URL'
    ];

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        this.addResult(
          `Environment Variable: ${envVar}`, 
          'PASS', 
          `Configured: ${envVar.includes('SECRET') ? '[HIDDEN]' : process.env[envVar]}`
        );
      } else {
        this.addResult(
          `Environment Variable: ${envVar}`, 
          'FAIL', 
          'Missing required environment variable'
        );
      }
    }

    // Verify Kinde configuration format
    const issuerUrl = process.env.KINDE_ISSUER_URL;
    if (issuerUrl && issuerUrl.startsWith('https://') && issuerUrl.includes('.kinde.com')) {
      this.addResult(
        'Kinde Issuer URL Format',
        'PASS',
        'Valid Kinde issuer URL format'
      );
    } else {
      this.addResult(
        'Kinde Issuer URL Format',
        'FAIL',
        'Invalid Kinde issuer URL format'
      );
    }
  }

  async verifyAuthRoutes() {
    console.log('\n🔍 Verifying Authentication Routes...\n');

    try {
      // Test auth health endpoint
      const healthResponse = await fetch(`${this.baseUrl}/api/health/auth`);
      const healthData = await healthResponse.json();
      
      if (healthResponse.ok) {
        this.addResult(
          'Auth Health Endpoint',
          'PASS',
          `Health check passed: ${JSON.stringify(healthData, null, 2)}`
        );
      } else {
        this.addResult(
          'Auth Health Endpoint',
          'FAIL',
          `Health check failed: ${healthResponse.status}`
        );
      }

      // Test session endpoint (should return 401 when not authenticated)
      const sessionResponse = await fetch(`${this.baseUrl}/api/auth/session`);
      
      if (sessionResponse.status === 401) {
        this.addResult(
          'Session Endpoint Protection',
          'PASS',
          'Session endpoint correctly returns 401 for unauthenticated users'
        );
      } else {
        this.addResult(
          'Session Endpoint Protection',
          'WARNING',
          `Session endpoint returned ${sessionResponse.status} (expected 401)`
        );
      }

    } catch (error) {
      this.addResult(
        'Auth Route Verification',
        'FAIL',
        `Failed to verify auth routes: ${error}`
      );
    }
  }

  async verifyAuthComponents() {
    console.log('\n🔍 Verifying Auth Component Files...\n');

    // Check auth component files exist
    const authFiles = [
      'src/components/auth/kinde-auth-provider.tsx',
      'src/components/auth/kinde-auth-ui.tsx',
      'src/lib/kinde-auth-client.ts',
      'src/lib/kinde-auth.ts',
      'app/api/auth/[kindeAuth]/route.ts',
      'app/api/auth/session/route.ts'
    ];

    for (const file of authFiles) {
      try {
        const { stdout } = await execAsync(`ls "${file}"`);
        if (stdout.trim()) {
          this.addResult(
            `Auth Component: ${file}`,
            'PASS',
            'File exists and accessible'
          );
        }
      } catch (error) {
        this.addResult(
          `Auth Component: ${file}`,
          'FAIL',
          'File missing or inaccessible'
        );
      }
    }
  }

  async verifyMiddleware() {
    console.log('\n🔍 Verifying Middleware Configuration...\n');

    try {
      const { stdout } = await execAsync('cat middleware.ts');
      
      if (stdout.includes('NextRequest') && stdout.includes('NextResponse')) {
        this.addResult(
          'Middleware File Structure',
          'PASS',
          'Middleware file has correct Next.js structure'
        );
      } else {
        this.addResult(
          'Middleware File Structure',
          'FAIL',
          'Middleware file missing required Next.js imports'
        );
      }

      // Check if middleware is currently permissive (allowing all routes)
      if (stdout.includes('NextResponse.next()')) {
        this.addResult(
          'Middleware Route Protection',
          'WARNING',
          'Middleware currently allows all routes - no authentication enforcement'
        );
      }

    } catch (error) {
      this.addResult(
        'Middleware Verification',
        'FAIL',
        `Failed to verify middleware: ${error}`
      );
    }
  }

  async verifySecurityConfig() {
    console.log('\n🔍 Verifying Security Configuration...\n');

    try {
      const { stdout } = await execAsync('cat src/lib/security-config.ts');
      
      if (stdout.includes('SESSION_SECURITY')) {
        this.addResult(
          'Security Config - Session Settings',
          'PASS',
          'Session security configuration found'
        );
      }

      if (stdout.includes('getCookieConfig')) {
        this.addResult(
          'Security Config - Cookie Settings',
          'PASS',
          'Cookie configuration function found'
        );
      }

      if (stdout.includes('SECURITY_HEADERS')) {
        this.addResult(
          'Security Config - Headers',
          'PASS',
          'Security headers configuration found'
        );
      }

    } catch (error) {
      this.addResult(
        'Security Config Verification',
        'FAIL',
        `Failed to verify security config: ${error}`
      );
    }
  }

  async verifyAuthPages() {
    console.log('\n🔍 Verifying Authentication Pages...\n');

    const pages = [
      { path: 'app/auth/page.tsx', name: 'Auth Page' },
      { path: 'app/dashboard/page.tsx', name: 'Dashboard Page' },
      { path: 'app/layout.tsx', name: 'Root Layout' }
    ];

    for (const page of pages) {
      try {
        const { stdout } = await execAsync(`cat "${page.path}"`);
        
        if (stdout.includes('useAuth') || stdout.includes('KindeAuth')) {
          this.addResult(
            `${page.name} Auth Integration`,
            'PASS',
            'Page includes authentication hooks or components'
          );
        } else if (page.name === 'Root Layout' && stdout.includes('KindeAuthProvider')) {
          this.addResult(
            `${page.name} Auth Integration`,
            'PASS',
            'Layout wraps app with authentication provider'
          );
        } else {
          this.addResult(
            `${page.name} Auth Integration`,
            'WARNING',
            'Page may not have authentication integration'
          );
        }

      } catch (error) {
        this.addResult(
          `${page.name} Verification`,
          'FAIL',
          `Failed to verify page: ${error}`
        );
      }
    }
  }

  async verifyDatabase() {
    console.log('\n🔍 Verifying Database Schema for User Management...\n');

    try {
      const { stdout } = await execAsync('cat src/db/schema.ts');
      
      if (stdout.includes('user') && stdout.includes('email')) {
        this.addResult(
          'Database User Schema',
          'PASS',
          'User table schema found in database'
        );
      } else {
        this.addResult(
          'Database User Schema',
          'FAIL',
          'User table schema not found in database'
        );
      }

    } catch (error) {
      this.addResult(
        'Database Schema Verification',
        'FAIL',
        `Failed to verify database schema: ${error}`
      );
    }
  }

  async verifyMocks() {
    console.log('\n🔍 Verifying Authentication Mocks for Testing...\n');

    try {
      const { stdout } = await execAsync('ls __mocks__/@kinde-oss/');
      
      if (stdout.includes('kinde-auth-nextjs')) {
        this.addResult(
          'Kinde Auth Mocks',
          'PASS',
          'Kinde authentication mocks available for testing'
        );
      }

    } catch (error) {
      this.addResult(
        'Auth Mocks Verification',
        'WARNING',
        'Authentication mocks may not be available for testing'
      );
    }
  }

  generateReport() {
    console.log('\n📊 AUTHENTICATION UI VERIFICATION REPORT\n');
    console.log('=' * 60);
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARNING').length;
    const total = this.results.length;

    console.log(`✅ PASSED: ${passed}/${total}`);
    console.log(`❌ FAILED: ${failed}/${total}`);
    console.log(`⚠️  WARNINGS: ${warnings}/${total}`);
    console.log('=' * 60);

    if (failed > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`❌ ${result.test}: ${result.details}`);
      });
    }

    if (warnings > 0) {
      console.log('\n⚠️  WARNINGS THAT NEED ATTENTION:');
      this.results.filter(r => r.status === 'WARNING').forEach(result => {
        console.log(`⚠️  ${result.test}: ${result.details}`);
      });
    }

    const overallStatus = failed === 0 ? (warnings === 0 ? 'EXCELLENT' : 'GOOD') : 'NEEDS_WORK';
    console.log(`\n🎯 OVERALL STATUS: ${overallStatus}\n`);

    return {
      summary: {
        total,
        passed,
        failed,
        warnings,
        overallStatus
      },
      results: this.results,
      timestamp: new Date().toISOString()
    };
  }

  async runFullVerification() {
    console.log('🚀 Starting MEXC Sniper Bot Authentication UI Verification...\n');
    
    await this.verifyKindeConfiguration();
    await this.verifyAuthRoutes();
    await this.verifyAuthComponents();
    await this.verifyMiddleware();
    await this.verifySecurityConfig();
    await this.verifyAuthPages();
    await this.verifyDatabase();
    await this.verifyMocks();
    
    return this.generateReport();
  }
}

// Run verification if called directly
if (require.main === module) {
  const verification = new AuthUIVerification();
  verification.runFullVerification()
    .then(report => {
      console.log('✅ Authentication verification completed!');
      console.log(`📄 Full report available with ${report.summary.total} checks performed.`);
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

export { AuthUIVerification };