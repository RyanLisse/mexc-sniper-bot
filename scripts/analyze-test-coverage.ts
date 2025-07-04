#!/usr/bin/env bun

/**
 * Test Coverage Analysis Script
 * Identifies files that need unit tests to achieve 100% coverage
 */

import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';

interface FileAnalysis {
  path: string;
  size: number;
  category: 'critical' | 'business-logic' | 'utility' | 'ui';
  priority: 'high' | 'medium' | 'low';
  hasTests: boolean;
  testPath?: string;
}

// Critical file patterns that must have 100% coverage
const CRITICAL_PATTERNS = [
  'src/services/api/mexc-*',
  'src/services/data/*',
  'src/services/execution/*',
  'src/core/**/*',
  'src/lib/risk-*',
  'src/lib/safety-*',
  'src/mexc-agents/**/*',
  'src/db/**/*',
  'src/domain/**/*',
];

// Business logic patterns that need high coverage
const BUSINESS_LOGIC_PATTERNS = [
  'src/services/**/*',
  'src/hooks/use-*',
  'src/utils/**/*',
  'src/infrastructure/**/*',
];

// UI patterns that need basic coverage
const UI_PATTERNS = [
  'src/components/**/*',
  'app/**/*',
];

async function findSourceFiles(): Promise<string[]> {
  console.log('📁 Scanning for source files...');
  
  const patterns = [
    'src/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
  ];
  
  const excludePatterns = [
    '**/*.d.ts',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**',
  ];
  
  let allFiles: string[] = [];
  
  for (const pattern of patterns) {
    try {
      const files = await glob(pattern, { 
        ignore: excludePatterns,
        cwd: process.cwd(),
        absolute: false
      });
      allFiles.push(...files);
    } catch (error) {
      console.warn(`⚠️ Error with pattern ${pattern}:`, error);
    }
  }
  
  // Remove duplicates and sort
  const uniqueFiles = [...new Set(allFiles)].sort();
  console.log(`📊 Found ${uniqueFiles.length} source files`);
  return uniqueFiles;
}

async function findExistingTests(): Promise<Set<string>> {
  console.log('🔍 Scanning for existing test files...');
  
  const testPatterns = [
    'tests/**/*.test.{ts,tsx}',
    'src/**/*.test.{ts,tsx}',
    'app/**/*.test.{ts,tsx}',
    '**/__tests__/**/*.{ts,tsx}',
  ];
  
  let allTests: string[] = [];
  
  for (const pattern of testPatterns) {
    try {
      const tests = await glob(pattern, {
        cwd: process.cwd(),
        absolute: false
      });
      allTests.push(...tests);
    } catch (error) {
      console.warn(`⚠️ Error finding tests with pattern ${pattern}:`, error);
    }
  }
  
  const testSet = new Set(allTests);
  console.log(`🧪 Found ${testSet.size} existing test files`);
  return testSet;
}

function categorizeFile(filePath: string): { category: FileAnalysis['category'], priority: FileAnalysis['priority'] } {
  // Check critical patterns first
  for (const pattern of CRITICAL_PATTERNS) {
    const globPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(globPattern);
    if (regex.test(filePath)) {
      return { category: 'critical', priority: 'high' };
    }
  }
  
  // Check business logic patterns
  for (const pattern of BUSINESS_LOGIC_PATTERNS) {
    const globPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(globPattern);
    if (regex.test(filePath)) {
      return { category: 'business-logic', priority: 'medium' };
    }
  }
  
  // Check UI patterns
  for (const pattern of UI_PATTERNS) {
    const globPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(globPattern);
    if (regex.test(filePath)) {
      return { category: 'ui', priority: 'low' };
    }
  }
  
  return { category: 'utility', priority: 'medium' };
}

function getExpectedTestPath(sourceFile: string): string {
  // Remove extension and add .test.ts
  const base = sourceFile.replace(/\.(ts|tsx)$/, '');
  
  // Determine test directory based on source location
  if (sourceFile.startsWith('src/')) {
    return `tests/unit/${base.replace('src/', '')}.test.ts`;
  } else if (sourceFile.startsWith('app/')) {
    return `tests/components/${base.replace('app/', '')}.test.tsx`;
  } else {
    return `tests/unit/${base}.test.ts`;
  }
}

async function analyzeFile(filePath: string, existingTests: Set<string>): Promise<FileAnalysis> {
  const stats = await fs.stat(filePath);
  const { category, priority } = categorizeFile(filePath);
  const expectedTestPath = getExpectedTestPath(filePath);
  
  // Check various possible test locations
  const possibleTestPaths = [
    expectedTestPath,
    `tests/${filePath}.test.ts`,
    `tests/${filePath}.test.tsx`,
    `${filePath}.test.ts`,
    `${filePath}.test.tsx`,
    expectedTestPath.replace('.test.ts', '.test.tsx'),
  ];
  
  const hasTests = possibleTestPaths.some(testPath => existingTests.has(testPath));
  const actualTestPath = possibleTestPaths.find(testPath => existingTests.has(testPath));
  
  return {
    path: filePath,
    size: stats.size,
    category,
    priority,
    hasTests,
    testPath: actualTestPath,
  };
}

async function generateCoverageReport(): Promise<void> {
  console.log('🎯 Generating Test Coverage Analysis Report\n');
  
  const sourceFiles = await findSourceFiles();
  const existingTests = await findExistingTests();
  
  console.log('📊 Analyzing files...\n');
  
  const analyses: FileAnalysis[] = [];
  
  for (const file of sourceFiles) {
    try {
      const analysis = await analyzeFile(file, existingTests);
      analyses.push(analysis);
    } catch (error) {
      console.warn(`⚠️ Error analyzing ${file}:`, error);
    }
  }
  
  // Group by category and priority
  const categories = {
    critical: analyses.filter(a => a.category === 'critical'),
    'business-logic': analyses.filter(a => a.category === 'business-logic'),
    utility: analyses.filter(a => a.category === 'utility'),
    ui: analyses.filter(a => a.category === 'ui'),
  };
  
  const untestedFiles = analyses.filter(a => !a.hasTests);
  const testedFiles = analyses.filter(a => a.hasTests);
  
  // Generate summary
  console.log('📈 COVERAGE ANALYSIS SUMMARY');
  console.log('=' .repeat(50));
  console.log(`Total source files: ${analyses.length}`);
  console.log(`Files with tests: ${testedFiles.length} (${((testedFiles.length / analyses.length) * 100).toFixed(1)}%)`);
  console.log(`Files without tests: ${untestedFiles.length} (${((untestedFiles.length / analyses.length) * 100).toFixed(1)}%)`);
  console.log('');
  
  // Critical files needing tests
  const criticalUntested = untestedFiles.filter(a => a.category === 'critical');
  console.log('🚨 CRITICAL FILES NEEDING TESTS (High Priority)');
  console.log('=' .repeat(50));
  if (criticalUntested.length === 0) {
    console.log('✅ All critical files have tests!');
  } else {
    criticalUntested.forEach((file, index) => {
      console.log(`${index + 1}. ${file.path}`);
      console.log(`   Expected test: ${getExpectedTestPath(file.path)}`);
      console.log(`   Size: ${(file.size / 1024).toFixed(1)}KB`);
      console.log('');
    });
  }
  
  // Business logic files needing tests
  const businessUntested = untestedFiles.filter(a => a.category === 'business-logic');
  console.log('⚡ BUSINESS LOGIC FILES NEEDING TESTS (Medium Priority)');
  console.log('=' .repeat(50));
  if (businessUntested.length === 0) {
    console.log('✅ All business logic files have tests!');
  } else {
    businessUntested.slice(0, 10).forEach((file, index) => {
      console.log(`${index + 1}. ${file.path}`);
      console.log(`   Expected test: ${getExpectedTestPath(file.path)}`);
      console.log('');
    });
    if (businessUntested.length > 10) {
      console.log(`... and ${businessUntested.length - 10} more files`);
    }
  }
  
  // Utility files needing tests
  const utilityUntested = untestedFiles.filter(a => a.category === 'utility');
  console.log('🔧 UTILITY FILES NEEDING TESTS');
  console.log('=' .repeat(50));
  if (utilityUntested.length === 0) {
    console.log('✅ All utility files have tests!');
  } else {
    utilityUntested.slice(0, 5).forEach((file, index) => {
      console.log(`${index + 1}. ${file.path}`);
    });
    if (utilityUntested.length > 5) {
      console.log(`... and ${utilityUntested.length - 5} more files`);
    }
  }
  
  // Generate detailed report file
  const reportData = {
    summary: {
      totalFiles: analyses.length,
      testedFiles: testedFiles.length,
      untestedFiles: untestedFiles.length,
      coveragePercentage: ((testedFiles.length / analyses.length) * 100).toFixed(1),
    },
    categories: {
      critical: {
        total: categories.critical.length,
        tested: categories.critical.filter(a => a.hasTests).length,
        untested: criticalUntested.length,
      },
      businessLogic: {
        total: categories['business-logic'].length,
        tested: categories['business-logic'].filter(a => a.hasTests).length,
        untested: businessUntested.length,
      },
      utility: {
        total: categories.utility.length,
        tested: categories.utility.filter(a => a.hasTests).length,
        untested: utilityUntested.length,
      },
      ui: {
        total: categories.ui.length,
        tested: categories.ui.filter(a => a.hasTests).length,
        untested: categories.ui.filter(a => !a.hasTests).length,
      },
    },
    untestedFiles: untestedFiles.map(f => ({
      path: f.path,
      category: f.category,
      priority: f.priority,
      expectedTestPath: getExpectedTestPath(f.path),
      size: f.size,
    })),
  };
  
  await fs.writeFile(
    'test-coverage-analysis.json',
    JSON.stringify(reportData, null, 2)
  );
  
  console.log('\n📋 NEXT STEPS TO ACHIEVE 100% COVERAGE:');
  console.log('=' .repeat(50));
  console.log('1. Start with critical files (trading/safety systems)');
  console.log('2. Focus on business logic files');
  console.log('3. Add utility function tests');
  console.log('4. Add basic component rendering tests');
  console.log('\n💾 Detailed report saved to: test-coverage-analysis.json');
  
  // Generate test file creation script
  const testCreationScript = untestedFiles
    .filter(f => f.priority === 'high' || f.category === 'critical')
    .map(f => {
      const testPath = getExpectedTestPath(f.path);
      const testDir = path.dirname(testPath);
      return `mkdir -p ${testDir} && echo "// TODO: Add tests for ${f.path}" > ${testPath}`;
    })
    .join('\n');
  
  await fs.writeFile('create-missing-tests.sh', testCreationScript);
  console.log('📝 Test creation script saved to: create-missing-tests.sh');
}

// Run the analysis
if (import.meta.main) {
  generateCoverageReport().catch(console.error);
}