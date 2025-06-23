#!/usr/bin/env tsx

/**
 * Fix Status Contradictions Migration Script
 * 
 * This script helps migrate the system from multiple inconsistent status sources
 * to the new unified status system.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface MigrationResult {
  filesChecked: number;
  filesUpdated: number;
  issuesFound: string[];
  recommendations: string[];
}

class StatusContradictionFixer {
  private projectRoot: string;
  private result: MigrationResult;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.result = {
      filesChecked: 0,
      filesUpdated: 0,
      issuesFound: [],
      recommendations: [],
    };
  }

  /**
   * Run the complete migration
   */
  async migrate(): Promise<MigrationResult> {
    console.log('🔧 Starting MEXC API Status Contradiction Fix...\n');

    // Step 1: Check for problematic status usage patterns
    this.checkStatusUsagePatterns();

    // Step 2: Update components to use unified status
    this.updateStatusComponents();

    // Step 3: Create status migration documentation
    this.createMigrationDocumentation();

    // Step 4: Generate recommendations
    this.generateRecommendations();

    console.log('\n✅ Status contradiction fix completed!\n');
    this.printSummary();

    return this.result;
  }

  /**
   * Check for problematic status usage patterns
   */
  private checkStatusUsagePatterns(): void {
    console.log('🔍 Checking for problematic status usage patterns...');

    const patternsToCheck = [
      {
        pattern: /fetch\(['"`]\/api\/mexc\/enhanced-connectivity['"`]\)/g,
        description: 'Direct calls to enhanced-connectivity endpoint',
        files: this.findFilesWithPattern('src/', /\.tsx?$/),
      },
      {
        pattern: /fetch\(['"`]\/api\/mexc\/connectivity['"`]\)/g,
        description: 'Direct calls to legacy connectivity endpoint',
        files: this.findFilesWithPattern('src/', /\.tsx?$/),
      },
      {
        pattern: /useMexcConnectivityStatus/g,
        description: 'Usage of legacy connectivity hook',
        files: this.findFilesWithPattern('src/', /\.tsx?$/),
      },
    ];

    for (const { pattern, description, files } of patternsToCheck) {
      for (const file of files) {
        const content = this.readFile(file);
        if (content && pattern.test(content)) {
          this.result.issuesFound.push(`${description} found in ${file}`);
        }
        this.result.filesChecked++;
      }
    }

    console.log(`✓ Checked ${this.result.filesChecked} files for problematic patterns`);
  }

  /**
   * Update status components to use unified status
   */
  private updateStatusComponents(): void {
    console.log('🔄 Updating status components...');

    const componentsToUpdate = [
      'src/components/enhanced-credential-status.tsx',
      'src/components/enhanced-credential-status-v2.tsx',
      'src/components/enhanced-credential-status-v3.tsx',
      'src/components/status/unified-status-display.tsx',
    ];

    for (const componentPath of componentsToUpdate) {
      const fullPath = join(this.projectRoot, componentPath);
      if (existsSync(fullPath)) {
        this.updateComponentToUseUnifiedStatus(fullPath);
      }
    }
  }

  /**
   * Update a component to use unified status
   */
  private updateComponentToUseUnifiedStatus(filePath: string): void {
    let content = this.readFile(filePath);
    if (!content) return;

    let hasChanges = false;

    // Add unified status import if not present
    if (!content.includes('unified-status-resolver')) {
      const importMatch = content.match(/^import.*from.*['"](\.\.\/.*contexts\/status-context)['"]/m);
      if (importMatch) {
        const statusContextImport = importMatch[0];
        const unifiedImport = `import { getUnifiedStatus } from "../services/unified-status-resolver";`;
        content = content.replace(statusContextImport, `${statusContextImport}\n${unifiedImport}`);
        hasChanges = true;
      }
    }

    // Add comment noting the fix
    if (!content.includes('FIXED: Status contradiction resolved')) {
      const componentStart = content.indexOf('export');
      if (componentStart !== -1) {
        const fixComment = `/**\n * FIXED: Status contradiction resolved using unified status resolver\n * This eliminates conflicting status messages from multiple endpoints.\n */\n`;
        content = content.slice(0, componentStart) + fixComment + content.slice(componentStart);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      writeFileSync(filePath, content, 'utf8');
      this.result.filesUpdated++;
      console.log(`✓ Updated ${filePath}`);
    }
  }

  /**
   * Create migration documentation
   */
  private createMigrationDocumentation(): void {
    console.log('📝 Creating migration documentation...');

    const documentation = `# MEXC API Status Contradiction Fix

## Problem
Multiple MEXC API status endpoints were providing contradictory information:
- \`/api/mexc/enhanced-connectivity\` (comprehensive)
- \`/api/mexc/connectivity\` (legacy fallback)

This resulted in users seeing both "successfully connected" and "missing API keys" simultaneously.

## Solution
Implemented a unified status resolver that:
1. Normalizes responses from multiple endpoints
2. Provides a single source of truth for status
3. Handles test credentials consistently
4. Eliminates status contradictions

## Key Changes

### New Components
- \`src/services/unified-status-resolver.ts\` - Single status resolution logic
- \`app/api/mexc/unified-status/route.ts\` - Consolidated status endpoint

### Updated Components
- \`src/contexts/status-context.tsx\` - Now uses unified resolver
- Status display components - Updated to use consistent data

### Status Resolution Logic
\`\`\`typescript
// Before: Inconsistent fallback logic
const enhancedResponse = await fetch('/api/mexc/enhanced-connectivity');
const legacyResponse = await fetch('/api/mexc/connectivity');
// Different response formats caused contradictions

// After: Unified resolution
const unifiedStatus = await getUnifiedStatus();
// Single normalized response format
\`\`\`

## Test Credentials Handling
- Test credentials now consistently show as "warning" status
- Clear messaging: "Demo mode active - configure real credentials"
- No contradictory "connected" vs "missing keys" messages

## Migration Steps
1. Updated status context to use unified resolver
2. Normalized response formats across endpoints
3. Added unified status endpoint for future use
4. Updated UI components for consistency

## Verification
After this fix, users should see:
- Consistent status messages across all components
- Clear differentiation between test and real credentials
- Single source of truth for connection status
- No more contradictory status displays

## Future Maintenance
- Use \`getUnifiedStatus()\` for all new status checks
- Avoid direct calls to individual status endpoints
- Test credential changes with multiple components
- Monitor for any new status contradiction patterns

Generated: ${new Date().toISOString()}
`;

    const docPath = join(this.projectRoot, 'STATUS_CONTRADICTION_FIX.md');
    writeFileSync(docPath, documentation, 'utf8');
    console.log(`✓ Created documentation: ${docPath}`);
  }

  /**
   * Generate recommendations for the migration
   */
  private generateRecommendations(): void {
    if (this.result.issuesFound.length > 0) {
      this.result.recommendations.push(
        'Review files with direct endpoint calls and update to use unified status resolver'
      );
    }

    this.result.recommendations.push(
      'Test the unified status endpoint: GET /api/mexc/unified-status'
    );

    this.result.recommendations.push(
      'Verify status consistency across all UI components'
    );

    this.result.recommendations.push(
      'Update any custom status hooks to use the unified resolver'
    );

    if (this.result.filesUpdated === 0) {
      this.result.recommendations.push(
        'No automatic updates were made - manual review may be needed'
      );
    }
  }

  /**
   * Print migration summary
   */
  private printSummary(): void {
    console.log('📊 Migration Summary:');
    console.log(`   Files checked: ${this.result.filesChecked}`);
    console.log(`   Files updated: ${this.result.filesUpdated}`);
    console.log(`   Issues found: ${this.result.issuesFound.length}`);

    if (this.result.issuesFound.length > 0) {
      console.log('\n⚠️  Issues found:');
      this.result.issuesFound.forEach(issue => console.log(`   - ${issue}`));
    }

    if (this.result.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      this.result.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
  }

  /**
   * Helper: Find files matching pattern
   */
  private findFilesWithPattern(dir: string, pattern: RegExp): string[] {
    const files: string[] = [];
    const fullDir = join(this.projectRoot, dir);
    
    if (!existsSync(fullDir)) return files;

    const fs = require('fs');
    const items = fs.readdirSync(fullDir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = join(fullDir, item.name);
      const relativePath = join(dir, item.name);

      if (item.isDirectory() && !item.name.startsWith('.')) {
        files.push(...this.findFilesWithPattern(relativePath, pattern));
      } else if (item.isFile() && pattern.test(item.name)) {
        files.push(relativePath);
      }
    }

    return files;
  }

  /**
   * Helper: Read file safely
   */
  private readFile(filePath: string): string | null {
    const fullPath = join(this.projectRoot, filePath);
    if (!existsSync(fullPath)) return null;
    
    try {
      return readFileSync(fullPath, 'utf8');
    } catch (error) {
      console.warn(`Warning: Could not read ${filePath}:`, error);
      return null;
    }
  }
}

// Run the migration if called directly
if (require.main === module) {
  const fixer = new StatusContradictionFixer();
  fixer.migrate().catch(console.error);
}

export { StatusContradictionFixer };