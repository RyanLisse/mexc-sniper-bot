#!/usr/bin/env node

/**
 * Backend Integration Validation Runner
 * Simple script to test all backend integration components
 */

interface ValidationResult {
  success: boolean;
  component: string;
  details: string;
  error?: string;
  duration: number;
}

interface ValidationReport {
  overall: {
    success: boolean;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    duration: number;
  };
  results: ValidationResult[];
  criticalIssues: string[];
  recommendations: string[];
}

async function validateBackend(): Promise<void> {
  console.log('=== BACKEND INTEGRATION VALIDATION ===\n');
  
  try {
    // Import with bun runtime support for path aliases
    const { getBackendValidator } = await import('../src/services/validation/backend-integration-validator');
    
    const validator = getBackendValidator();
    const report: ValidationReport = await validator.validateBackendIntegration();
    
    console.log('OVERALL RESULTS:');
    console.log(`- Success: ${report.overall.success}`);
    console.log(`- Total Tests: ${report.overall.totalTests}`);
    console.log(`- Passed: ${report.overall.passedTests}`);
    console.log(`- Failed: ${report.overall.failedTests}`);
    console.log(`- Duration: ${report.overall.duration}ms`);
    console.log('');
    
    console.log('DETAILED RESULTS:');
    report.results.forEach((result: ValidationResult) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} - ${result.component}`);
      console.log(`   Details: ${result.details}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log(`   Duration: ${result.duration}ms`);
      console.log('');
    });
    
    if (report.criticalIssues.length > 0) {
      console.log('🚨 CRITICAL ISSUES:');
      report.criticalIssues.forEach((issue: string) => console.log(`- ${issue}`));
      console.log('');
    }
    
    console.log('📋 RECOMMENDATIONS:');
    report.recommendations.forEach((rec: string) => console.log(`- ${rec}`));
    
    console.log('\n=== VALIDATION COMPLETE ===');
    process.exit(report.overall.success ? 0 : 1);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Validation script failed:', errorMessage);
    console.error('Error details:', error);
    process.exit(1);
  }
}

validateBackend();