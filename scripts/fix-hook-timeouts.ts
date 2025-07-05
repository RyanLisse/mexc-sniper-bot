#!/usr/bin/env tsx
/**
 * Hook Timeout Fix Script
 * 
 * MISSION: Systematically fix all hook timeout issues across the test suite
 * 
 * This script:
 * - Scans all test files for hook timeout problems
 * - Applies comprehensive timeout fixes
 * - Adds proper async handling to hooks
 * - Updates timeout configurations
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

interface HookTimeoutFix {
  filePath: string;
  issues: string[];
  fixes: string[];
}

const PROJECT_ROOT = process.cwd();
const TESTS_DIR = path.join(PROJECT_ROOT, 'tests');

// Hook timeout patterns to detect and fix
const HOOK_TIMEOUT_PATTERNS = [
  {
    pattern: /beforeEach\(\s*async\s*\(\)\s*=>\s*\{/g,
    replacement: 'beforeEach(async () => {',
    issue: 'beforeEach without explicit timeout',
    fix: 'Add explicit timeout to beforeEach hook'
  },
  {
    pattern: /afterEach\(\s*async\s*\(\)\s*=>\s*\{/g,
    replacement: 'afterEach(async () => {',
    issue: 'afterEach without explicit timeout',
    fix: 'Add explicit timeout to afterEach hook'
  },
  {
    pattern: /beforeAll\(\s*async\s*\(\)\s*=>\s*\{/g,
    replacement: 'beforeAll(async () => {',
    issue: 'beforeAll without explicit timeout',
    fix: 'Add explicit timeout to beforeAll hook'
  },
  {
    pattern: /afterAll\(\s*async\s*\(\)\s*=>\s*\{/g,
    replacement: 'afterAll(async () => {',
    issue: 'afterAll without explicit timeout',
    fix: 'Add explicit timeout to afterAll hook'
  }
];

// Problematic async patterns in hooks
const ASYNC_PATTERNS = [
  {
    pattern: /await\s+new\s+Promise\(resolve\s*=>\s*setTimeout\(resolve,\s*\d+\)\)/g,
    issue: 'setTimeout in hook without timeout protection',
    fix: 'Wrap setTimeout operations with timeout protection'
  },
  {
    pattern: /\.mockResolvedValue\(/g,
    issue: 'Mock setup without async protection',
    fix: 'Add async timeout protection to mock setup'
  },
  {
    pattern: /vi\.clearAllMocks\(\)/g,
    issue: 'Mock cleanup without timeout protection',
    fix: 'Add timeout protection to mock cleanup'
  }
];

/**
 * Scan test file for hook timeout issues
 */
function scanTestFile(filePath: string): HookTimeoutFix {
  const content = readFileSync(filePath, 'utf-8');
  const issues: string[] = [];
  const fixes: string[] = [];

  // Check for hook timeout patterns
  HOOK_TIMEOUT_PATTERNS.forEach(({ pattern, issue, fix }) => {
    if (pattern.test(content)) {
      issues.push(issue);
      fixes.push(fix);
    }
  });

  // Check for async patterns
  ASYNC_PATTERNS.forEach(({ pattern, issue, fix }) => {
    if (pattern.test(content)) {
      issues.push(issue);
      fixes.push(fix);
    }
  });

  // Check for missing timeout imports
  if (!content.includes('TIMEOUT_CONFIG') && content.includes('beforeEach')) {
    issues.push('Missing timeout configuration import');
    fixes.push('Add timeout configuration import');
  }

  // Check for explicit timeout parameters
  if (content.includes('beforeEach(') && !content.includes('}, TIMEOUT_CONFIG')) {
    issues.push('Hook missing explicit timeout parameter');
    fixes.push('Add explicit timeout parameters to hooks');
  }

  return { filePath, issues, fixes };
}

/**
 * Apply comprehensive hook timeout fixes to a test file
 */
function fixTestFile(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8');
  let modified = false;

  // Add timeout imports if missing
  if (!content.includes('TIMEOUT_CONFIG') && content.includes('beforeEach')) {
    const importLine = `import { 
  setupTimeoutElimination, 
  withTimeout, 
  TIMEOUT_CONFIG,
  flushPromises 
} from '../utils/timeout-utilities';\n`;

    // Find existing import section
    const importSectionMatch = content.match(/import.*from.*['"];?\n/g);
    if (importSectionMatch) {
      const lastImportIndex = content.lastIndexOf(importSectionMatch[importSectionMatch.length - 1]);
      const insertIndex = lastImportIndex + importSectionMatch[importSectionMatch.length - 1].length;
      content = content.slice(0, insertIndex) + '\n' + importLine + content.slice(insertIndex);
      modified = true;
    }
  }

  // Fix beforeEach hooks without explicit timeouts
  content = content.replace(
    /beforeEach\(async\s*\(\)\s*=>\s*\{/g,
    'beforeEach(async () => {'
  );

  // Add timeout parameters to hooks where missing
  content = content.replace(
    /beforeEach\(async\s*\(\)\s*=>\s*\{([^}]+)\}\);/g,
    (match, hookBody) => {
      if (!match.includes('TIMEOUT_CONFIG')) {
        modified = true;
        return `beforeEach(async () => {${hookBody}}, TIMEOUT_CONFIG.HOOK_BEFORE_EACH);`;
      }
      return match;
    }
  );

  content = content.replace(
    /afterEach\(async\s*\(\)\s*=>\s*\{([^}]+)\}\);/g,
    (match, hookBody) => {
      if (!match.includes('TIMEOUT_CONFIG')) {
        modified = true;
        return `afterEach(async () => {${hookBody}}, TIMEOUT_CONFIG.HOOK_AFTER_EACH);`;
      }
      return match;
    }
  );

  // Wrap async operations in hooks with timeout protection
  content = content.replace(
    /(beforeEach\(async\s*\(\)\s*=>\s*\{[\s\S]*?)vi\.clearAllMocks\(\);([\s\S]*?\})/g,
    (match, beforePart, afterPart) => {
      if (!match.includes('timeoutSafeMockSetup')) {
        modified = true;
        return `${beforePart}await timeoutSafeMockSetup(() => { vi.clearAllMocks(); });${afterPart}`;
      }
      return match;
    }
  );

  // Add timeout safe cleanup to afterEach
  content = content.replace(
    /(afterEach\(async\s*\(\)\s*=>\s*\{[\s\S]*?)vi\.restoreAllMocks\(\);([\s\S]*?\})/g,
    (match, beforePart, afterPart) => {
      if (!match.includes('timeoutSafeCleanup')) {
        modified = true;
        return `${beforePart}await timeoutSafeCleanup(() => { vi.restoreAllMocks(); });${afterPart}`;
      }
      return match;
    }
  );

  // Add timeout safe imports if used
  if (content.includes('timeoutSafeMockSetup') || content.includes('timeoutSafeCleanup')) {
    if (!content.includes('timeoutSafeMockSetup')) {
      content = content.replace(
        /from ['"]\.\.\/utils\/timeout-utilities['"];?/,
        `from '../utils/timeout-utilities';
import { timeoutSafeMockSetup, timeoutSafeCleanup } from '../setup/hook-timeout-configuration';`
      );
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(filePath, content, 'utf-8');
    return true;
  }

  return false;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🎯 HOOK TIMEOUT FIX: Starting comprehensive hook timeout resolution...\n');

  // Find all test files
  const testFiles = await glob('**/*.test.{ts,tsx}', {
    cwd: TESTS_DIR,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/coverage/**']
  });

  console.log(`📁 Found ${testFiles.length} test files to analyze\n`);

  const results: HookTimeoutFix[] = [];
  let fixedFiles = 0;

  // Scan and fix each test file
  for (const filePath of testFiles) {
    const relativePath = path.relative(PROJECT_ROOT, filePath);
    console.log(`🔍 Analyzing: ${relativePath}`);

    const scanResult = scanTestFile(filePath);
    results.push(scanResult);

    if (scanResult.issues.length > 0) {
      console.log(`   ⚠️  Found ${scanResult.issues.length} issues:`);
      scanResult.issues.forEach(issue => console.log(`      - ${issue}`));

      const wasFixed = fixTestFile(filePath);
      if (wasFixed) {
        fixedFiles++;
        console.log(`   ✅ Applied fixes`);
      } else {
        console.log(`   ℹ️  No automated fixes available`);
      }
    } else {
      console.log(`   ✅ No hook timeout issues detected`);
    }
    console.log('');
  }

  // Summary report
  console.log('📊 HOOK TIMEOUT FIX SUMMARY:');
  console.log(`   Total test files analyzed: ${testFiles.length}`);
  console.log(`   Files with hook timeout issues: ${results.filter(r => r.issues.length > 0).length}`);
  console.log(`   Files automatically fixed: ${fixedFiles}`);
  console.log('');

  // Detailed issue breakdown
  const allIssues = results.flatMap(r => r.issues);
  const issueCategories = allIssues.reduce((acc, issue) => {
    acc[issue] = (acc[issue] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (Object.keys(issueCategories).length > 0) {
    console.log('📋 ISSUE BREAKDOWN:');
    Object.entries(issueCategories).forEach(([issue, count]) => {
      console.log(`   ${issue}: ${count} occurrences`);
    });
    console.log('');
  }

  // Recommendations
  console.log('💡 RECOMMENDATIONS:');
  console.log('   1. Run tests to verify hook timeout fixes are working');
  console.log('   2. Monitor test execution for any remaining timeout issues');
  console.log('   3. Consider increasing hook timeouts for complex test setups');
  console.log('   4. Use timeoutSafeMockSetup and timeoutSafeCleanup for async operations in hooks');
  console.log('');

  console.log('✅ HOOK TIMEOUT FIX: Resolution completed successfully!');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

export { scanTestFile, fixTestFile };