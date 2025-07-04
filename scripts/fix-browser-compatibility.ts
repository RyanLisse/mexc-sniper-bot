#!/usr/bin/env bun

/**
 * Browser Compatibility Fix Script
 * 
 * Systematically replaces Node.js EventEmitter usage with browser-compatible alternatives
 * across the entire codebase to ensure client-side compatibility.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { globSync } from 'glob';

interface FixResult {
  file: string;
  changes: string[];
  success: boolean;
  error?: string;
}

class BrowserCompatibilityFixer {
  private projectRoot: string;
  private results: FixResult[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  /**
   * Main execution method
   */
  async run(): Promise<void> {
    console.log('🔧 Starting Browser Compatibility Fix...\n');

    // Find all TypeScript files that might need fixing
    const patterns = [
      'src/**/*.ts',
      'src/**/*.tsx',
      '!src/**/*.test.ts',
      '!src/**/*.spec.ts',
      '!tests/**/*',
      '!node_modules/**/*'
    ];

    const files = globSync(patterns, { cwd: this.projectRoot });
    console.log(`Found ${files.length} TypeScript files to analyze...\n`);

    // Process each file
    for (const file of files) {
      const fullPath = join(this.projectRoot, file);
      try {
        const result = await this.fixFile(fullPath, file);
        this.results.push(result);

        if (result.changes.length > 0) {
          console.log(`✅ Fixed: ${file}`);
          result.changes.forEach(change => console.log(`   - ${change}`));
          console.log();
        }
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error);
        this.results.push({
          file,
          changes: [],
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.printSummary();
  }

  /**
   * Fix a single file
   */
  private async fixFile(filePath: string, relativePath: string): Promise<FixResult> {
    if (!existsSync(filePath)) {
      return { file: relativePath, changes: [], success: false, error: 'File not found' };
    }

    let content = readFileSync(filePath, 'utf-8');
    const originalContent = content;
    const changes: string[] = [];

    // 1. Replace Node.js EventEmitter imports (various patterns)
    const eventEmitterImportPattern = /import\s*\{\s*EventEmitter\s*\}\s*from\s*['"][^'"]*events['"]/g;
    if (eventEmitterImportPattern.test(content)) {
      content = content.replace(
        eventEmitterImportPattern,
        'import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events"'
      );
      changes.push('Replaced Node.js EventEmitter import with browser-compatible version');
    }

    // 2. Replace "node:events" imports
    const nodeEventsPattern = /import\s*\{\s*EventEmitter\s*\}\s*from\s*['"]node:events['"]/g;
    if (nodeEventsPattern.test(content)) {
      content = content.replace(
        nodeEventsPattern,
        'import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events"'
      );
      changes.push('Replaced node:events import with browser-compatible version');
    }

    // 3. Replace default EventEmitter imports from "events" or "node:events"
    const defaultEventEmitterPattern = /import\s+EventEmitter\s+from\s+['"](?:node:)?events['"]/g;
    if (defaultEventEmitterPattern.test(content)) {
      content = content.replace(
        defaultEventEmitterPattern,
        'import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events"'
      );
      changes.push('Replaced default EventEmitter import with browser-compatible version');
    }

    // 4. Replace any remaining "events" module imports
    const remainingEventsPattern = /import\s+.*from\s+['"](?:node:)?events['"]/g;
    if (remainingEventsPattern.test(content)) {
      content = content.replace(
        remainingEventsPattern,
        'import { BrowserCompatibleEventEmitter } from "@/src/lib/browser-compatible-events"'
      );
      changes.push('Replaced remaining events module import with browser-compatible version');
    }

    // 5. Replace class extensions
    const classExtendsPattern = /class\s+(\w+)\s+extends\s+EventEmitter(\<[^>]*\>)?\s*\{/g;
    const classMatches = content.match(classExtendsPattern);
    if (classMatches) {
      content = content.replace(classExtendsPattern, 'class $1 extends BrowserCompatibleEventEmitter {');
      changes.push(`Updated class to extend BrowserCompatibleEventEmitter`);
    }

    // 6. Replace EventEmitter references in variable declarations and type annotations
    const eventEmitterTypePattern = /:\s*EventEmitter\b/g;
    if (eventEmitterTypePattern.test(content)) {
      content = content.replace(eventEmitterTypePattern, ': BrowserCompatibleEventEmitter');
      changes.push('Updated EventEmitter type annotations');
    }

    // 7. Replace EventEmitter instantiation
    const eventEmitterNewPattern = /new\s+EventEmitter\(\)/g;
    if (eventEmitterNewPattern.test(content)) {
      content = content.replace(eventEmitterNewPattern, 'new BrowserCompatibleEventEmitter()');
      changes.push('Replaced EventEmitter instantiation');
    }

    // 8. Fix WebSocket imports for universal compatibility
    const wsImportPattern = /import\s*\*\s*as\s+WebSocket\s+from\s*['"]ws['"]/g;
    if (wsImportPattern.test(content)) {
      content = content.replace(
        wsImportPattern,
        `// Universal WebSocket implementation - works in both browser and Node.js
const UniversalWebSocket = (() => {
  if (typeof window !== 'undefined' && window.WebSocket) {
    // Browser environment
    return window.WebSocket;
  } else {
    // Node.js environment
    try {
      return require('ws');
    } catch {
      throw new Error('WebSocket implementation not available. Install "ws" package for Node.js environments.');
    }
  }
})();`
      );
      changes.push('Replaced WebSocket import with universal implementation');
    }

    // 9. Fix "ws" WebSocket imports
    const wsImportPattern2 = /import\s+WebSocket\s+from\s*['"]ws['"]/g;
    if (wsImportPattern2.test(content)) {
      content = content.replace(
        wsImportPattern2,
        `// Universal WebSocket implementation
const UniversalWebSocket = (() => {
  if (typeof window !== 'undefined' && window.WebSocket) {
    return window.WebSocket;
  } else {
    try {
      return require('ws');
    } catch {
      throw new Error('WebSocket implementation not available. Install "ws" package for Node.js environments.');
    }
  }
})();`
      );
      changes.push('Replaced WebSocket import with universal implementation');
    }

    // 10. Fix WebSocket type references
    content = content.replace(/WebSocket\.default/g, 'InstanceType<typeof UniversalWebSocket>');
    content = content.replace(/:\s*WebSocket(\s)/g, ': InstanceType<typeof UniversalWebSocket>$1');

    // 11. Fix Node.js crypto imports
    const cryptoImportPattern = /import\s*\{\s*([^}]*)\s*\}\s*from\s*['"]node:crypto['"]/g;
    let cryptoMatch;
    while ((cryptoMatch = cryptoImportPattern.exec(content)) !== null) {
      const imports = cryptoMatch[1];
      content = content.replace(
        cryptoMatch[0],
        `import { UniversalCrypto } from "@/src/lib/browser-compatible-events"`
      );
      
      // Replace createHash usage
      if (imports.includes('createHash')) {
        content = content.replace(/createHash\(/g, 'UniversalCrypto.createHash(');
      }
      
      // Replace randomUUID usage  
      if (imports.includes('randomUUID')) {
        content = content.replace(/randomUUID\(\)/g, 'UniversalCrypto.randomUUID()');
      }
      
      changes.push('Replaced node:crypto import with browser-compatible version');
    }

    // 12. Fix individual crypto imports
    const individualCryptoPattern = /import\s*\{\s*createHash\s*\}\s*from\s*['"]node:crypto['"]/g;
    if (individualCryptoPattern.test(content)) {
      content = content.replace(
        individualCryptoPattern,
        'import { UniversalCrypto } from "@/src/lib/browser-compatible-events"'
      );
      content = content.replace(/createHash\(/g, 'UniversalCrypto.createHash(');
      changes.push('Replaced createHash import with universal implementation');
    }

    // 13. Fix default crypto imports
    const defaultCryptoPattern = /import\s+crypto\s+from\s+['"]node:crypto['"]/g;
    if (defaultCryptoPattern.test(content)) {
      content = content.replace(
        defaultCryptoPattern,
        'import { UniversalCrypto as crypto } from "@/src/lib/browser-compatible-events"'
      );
      changes.push('Replaced default crypto import with universal implementation');
    }

    // 14. Consolidate Universal WebSocket imports
    const wsUniversalPattern = /\/\/ Universal WebSocket implementation[\s\S]*?\}\)\(\);/g;
    if (wsUniversalPattern.test(content) && !content.includes('import { UniversalWebSocket }')) {
      content = content.replace(
        wsUniversalPattern,
        ''
      );
      // Add import at the top if not already present
      if (!content.includes('UniversalWebSocket')) {
        const importLine = `import { UniversalWebSocket } from "@/src/lib/browser-compatible-events";\n`;
        content = importLine + content;
        changes.push('Consolidated Universal WebSocket implementation');
      }
    }

    // 15. Add environment detection utilities if needed
    if (content.includes('process.') && !content.includes('typeof window')) {
      const envCheckPattern = /process\.(env|platform|version)/g;
      if (envCheckPattern.test(content) && !content.includes('isNodeEnvironment')) {
        const envImport = `import { isNodeEnvironment, isBrowserEnvironment } from "@/src/lib/browser-compatible-events";\n`;
        if (!content.includes(envImport.trim())) {
          content = envImport + content;
          changes.push('Added environment detection utilities');
        }
      }
    }

    // Write file only if there were changes
    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8');
      return { file: relativePath, changes, success: true };
    }

    return { file: relativePath, changes: [], success: true };
  }

  /**
   * Print summary of fixes
   */
  private printSummary(): void {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const withChanges = successful.filter(r => r.changes.length > 0);

    console.log('\n🏁 Browser Compatibility Fix Summary');
    console.log('=====================================');
    console.log(`Total files processed: ${this.results.length}`);
    console.log(`Files fixed: ${withChanges.length}`);
    console.log(`Files with no changes needed: ${successful.length - withChanges.length}`);
    console.log(`Files with errors: ${failed.length}`);

    if (withChanges.length > 0) {
      console.log('\n✅ Files Successfully Fixed:');
      withChanges.forEach(result => {
        console.log(`  - ${result.file} (${result.changes.length} changes)`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Files with Errors:');
      failed.forEach(result => {
        console.log(`  - ${result.file}: ${result.error}`);
      });
    }

    const totalChanges = withChanges.reduce((sum, r) => sum + r.changes.length, 0);
    console.log(`\n🎉 Total changes made: ${totalChanges}`);
    console.log('✅ Browser compatibility fixes completed!');
  }
}

// Execute the script
async function main() {
  const projectRoot = process.cwd();
  const fixer = new BrowserCompatibilityFixer(projectRoot);
  await fixer.run();
}

if (require.main === module) {
  main().catch(console.error);
}

export { BrowserCompatibilityFixer };