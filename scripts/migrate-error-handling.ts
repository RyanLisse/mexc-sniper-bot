#!/usr/bin/env bun
/**
 * Error Handling Migration Script
 * 
 * Automatically migrates API routes and services to use standardized error handling patterns.
 * Run with: bun run scripts/migrate-error-handling.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import { join, dirname } from 'path';

interface MigrationStats {
  filesProcessed: number;
  apiRoutesFixed: number;
  instanceofReplacements: number;
  importsAdded: number;
  errorsFound: string[];
}

class ErrorHandlingMigrator {
  private stats: MigrationStats = {
    filesProcessed: 0,
    apiRoutesFixed: 0,
    instanceofReplacements: 0,
    importsAdded: 0,
    errorsFound: []
  };

  async migrate(dryRun: boolean = false): Promise<MigrationStats> {
    console.log('🚀 Starting Error Handling Migration...');
    console.log(`Mode: ${dryRun ? 'DRY RUN (no files will be changed)' : 'LIVE MIGRATION'}`);
    
    // Migrate API routes
    await this.migrateApiRoutes(dryRun);
    
    // Migrate services
    await this.migrateServices(dryRun);
    
    // Migrate hooks
    await this.migrateHooks(dryRun);
    
    this.printStats();
    return this.stats;
  }

  private async migrateApiRoutes(dryRun: boolean): Promise<void> {
    console.log('\n📁 Migrating API Routes...');
    
    const apiFiles = glob.sync('app/api/**/route.ts');
    console.log(`Found ${apiFiles.length} API route files`);
    
    for (const file of apiFiles) {
      await this.migrateApiRoute(file, dryRun);
    }
  }

  private async migrateApiRoute(filePath: string, dryRun: boolean): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf8');
      let newContent = content;
      let hasChanges = false;

      // Check if already migrated
      if (content.includes('asyncHandler') || content.includes('handleApiError')) {
        console.log(`⏭️  Skipping ${filePath} (already migrated)`);
        return;
      }

      // Add required imports
      const importsToAdd = this.getRequiredImports(content);
      if (importsToAdd.length > 0) {
        newContent = this.addImports(newContent, importsToAdd);
        hasChanges = true;
        this.stats.importsAdded++;
      }

      // Replace instanceof Error patterns
      const instanceofReplaced = this.replaceInstanceofError(newContent);
      if (instanceofReplaced.changed) {
        newContent = instanceofReplaced.content;
        hasChanges = true;
        this.stats.instanceofReplacements += instanceofReplaced.count;
      }

      // Migrate catch blocks to use handleApiError
      const catchMigrated = this.migrateCatchBlocks(newContent);
      if (catchMigrated.changed) {
        newContent = catchMigrated.content;
        hasChanges = true;
      }

      // Standardize success responses
      const successMigrated = this.migrateSuccessResponses(newContent);
      if (successMigrated.changed) {
        newContent = successMigrated.content;
        hasChanges = true;
      }

      if (hasChanges) {
        if (!dryRun) {
          writeFileSync(filePath, newContent);
        }
        console.log(`✅ ${dryRun ? 'Would migrate' : 'Migrated'} ${filePath}`);
        this.stats.apiRoutesFixed++;
      }
      
      this.stats.filesProcessed++;
    } catch (error) {
      const errorMsg = `Error processing ${filePath}: ${error}`;
      this.stats.errorsFound.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  private async migrateServices(dryRun: boolean): Promise<void> {
    console.log('\n🔧 Migrating Services...');
    
    const serviceFiles = glob.sync('src/services/**/*.ts');
    console.log(`Found ${serviceFiles.length} service files`);
    
    for (const file of serviceFiles) {
      await this.migrateService(file, dryRun);
    }
  }

  private async migrateService(filePath: string, dryRun: boolean): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf8');
      let newContent = content;
      let hasChanges = false;

      // Replace instanceof Error patterns
      const instanceofReplaced = this.replaceInstanceofError(newContent);
      if (instanceofReplaced.changed) {
        newContent = instanceofReplaced.content;
        hasChanges = true;
        this.stats.instanceofReplacements += instanceofReplaced.count;
      }

      // Add proper error imports if catch blocks exist
      if (content.includes('catch (') && !content.includes('toSafeError')) {
        const importsToAdd = ['toSafeError', 'getErrorMessage'];
        newContent = this.addImports(newContent, importsToAdd, 'error-type-utils');
        hasChanges = true;
        this.stats.importsAdded++;
      }

      // Improve catch block patterns
      const catchImproved = this.improveCatchBlocks(newContent);
      if (catchImproved.changed) {
        newContent = catchImproved.content;
        hasChanges = true;
      }

      if (hasChanges) {
        if (!dryRun) {
          writeFileSync(filePath, newContent);
        }
        console.log(`✅ ${dryRun ? 'Would migrate' : 'Migrated'} ${filePath}`);
      }
      
      this.stats.filesProcessed++;
    } catch (error) {
      const errorMsg = `Error processing ${filePath}: ${error}`;
      this.stats.errorsFound.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  private async migrateHooks(dryRun: boolean): Promise<void> {
    console.log('\n🎣 Migrating Hooks...');
    
    const hookFiles = glob.sync('src/hooks/**/*.ts');
    console.log(`Found ${hookFiles.length} hook files`);
    
    for (const file of hookFiles) {
      await this.migrateHook(file, dryRun);
    }
  }

  private async migrateHook(filePath: string, dryRun: boolean): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf8');
      let newContent = content;
      let hasChanges = false;

      // Replace instanceof Error patterns
      const instanceofReplaced = this.replaceInstanceofError(newContent);
      if (instanceofReplaced.changed) {
        newContent = instanceofReplaced.content;
        hasChanges = true;
        this.stats.instanceofReplacements += instanceofReplaced.count;
      }

      if (hasChanges) {
        if (!dryRun) {
          writeFileSync(filePath, newContent);
        }
        console.log(`✅ ${dryRun ? 'Would migrate' : 'Migrated'} ${filePath}`);
      }
      
      this.stats.filesProcessed++;
    } catch (error) {
      const errorMsg = `Error processing ${filePath}: ${error}`;
      this.stats.errorsFound.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
    }
  }

  private getRequiredImports(content: string): string[] {
    const imports: string[] = [];
    
    if (content.includes('NextResponse.json') && !content.includes('apiResponse')) {
      imports.push('apiResponse');
    }
    
    if (content.includes('catch (') && !content.includes('handleApiError')) {
      imports.push('handleApiError');
    }
    
    if (content.includes('instanceof Error') && !content.includes('getErrorMessage')) {
      imports.push('getErrorMessage');
    }
    
    return imports;
  }

  private addImports(content: string, imports: string[], module?: string): string {
    const moduleMap = {
      'apiResponse': '@/src/lib/api-response',
      'handleApiError': '@/src/lib/error-handler',
      'getErrorMessage': '@/src/lib/error-type-utils',
      'toSafeError': '@/src/lib/error-type-utils'
    };

    // Group imports by module
    const importsByModule: Record<string, string[]> = {};
    
    imports.forEach(imp => {
      const mod = module || moduleMap[imp] || '@/src/lib/error-type-utils';
      if (!importsByModule[mod]) {
        importsByModule[mod] = [];
      }
      importsByModule[mod].push(imp);
    });

    let newContent = content;
    
    // Add import statements
    Object.entries(importsByModule).forEach(([mod, imps]) => {
      const importStatement = `import { ${imps.join(', ')} } from '${mod}';\n`;
      
      // Find the best place to insert the import
      const lines = newContent.split('\n');
      let insertIndex = 0;
      
      // Find last import statement
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('import ')) {
          insertIndex = i + 1;
        } else if (lines[i].trim() && !lines[i].trim().startsWith('import ')) {
          break;
        }
      }
      
      lines.splice(insertIndex, 0, importStatement);
      newContent = lines.join('\n');
    });

    return newContent;
  }

  private replaceInstanceofError(content: string): { content: string; changed: boolean; count: number } {
    let newContent = content;
    let count = 0;
    
    // Pattern 1: error instanceof Error ? error.message : "Unknown error"
    const pattern1 = /(\w+)\s+instanceof\s+Error\s*\?\s*\1\.message\s*:\s*["`']Unknown error["`']/g;
    const replacement1 = 'getErrorMessage($1)';
    const matches1 = newContent.match(pattern1);
    if (matches1) {
      count += matches1.length;
      newContent = newContent.replace(pattern1, replacement1);
    }

    // Pattern 2: error instanceof Error ? error.message : String(error)
    const pattern2 = /(\w+)\s+instanceof\s+Error\s*\?\s*\1\.message\s*:\s*String\(\1\)/g;
    const replacement2 = 'getErrorMessage($1)';
    const matches2 = newContent.match(pattern2);
    if (matches2) {
      count += matches2.length;
      newContent = newContent.replace(pattern2, replacement2);
    }

    // Pattern 3: error instanceof Error ? error.message : "some default"
    const pattern3 = /(\w+)\s+instanceof\s+Error\s*\?\s*\1\.message\s*:\s*["`'][^"`']*["`']/g;
    const replacement3 = 'getErrorMessage($1)';
    const matches3 = newContent.match(pattern3);
    if (matches3) {
      count += matches3.length;
      newContent = newContent.replace(pattern3, replacement3);
    }

    return {
      content: newContent,
      changed: count > 0,
      count
    };
  }

  private migrateCatchBlocks(content: string): { content: string; changed: boolean } {
    let newContent = content;
    let changed = false;

    // Replace manual NextResponse.json error patterns
    const errorResponsePattern = /NextResponse\.json\(\s*{\s*error:\s*([^}]+)\s*},\s*{\s*status:\s*(\d+)\s*}\s*\)/g;
    if (errorResponsePattern.test(content)) {
      newContent = newContent.replace(errorResponsePattern, 'apiResponse.error($1, $2)');
      changed = true;
    }

    // Replace manual error object patterns
    const manualErrorPattern = /NextResponse\.json\(\s*{\s*success:\s*false,\s*error:\s*([^}]+)[^}]*},\s*{\s*status:\s*(\d+)\s*}\s*\)/g;
    if (manualErrorPattern.test(content)) {
      newContent = newContent.replace(manualErrorPattern, 'apiResponse.error($1, $2)');
      changed = true;
    }

    return { content: newContent, changed };
  }

  private migrateSuccessResponses(content: string): { content: string; changed: boolean } {
    let newContent = content;
    let changed = false;

    // Replace manual success responses
    const successPattern = /NextResponse\.json\(\s*{\s*success:\s*true,\s*([^}]+)\s*}\s*\)/g;
    if (successPattern.test(content)) {
      newContent = newContent.replace(successPattern, 'apiResponse.success({ $1 })');
      changed = true;
    }

    // Replace simple data responses
    const dataPattern = /NextResponse\.json\(\s*([^{][^)]+)\s*\)/g;
    if (dataPattern.test(content)) {
      // Only replace if it looks like a data response (not an error)
      const matches = content.match(dataPattern);
      if (matches) {
        matches.forEach(match => {
          if (!match.includes('error') && !match.includes('success: false')) {
            const dataCapture = match.replace(/NextResponse\.json\(\s*([^)]+)\s*\)/, '$1');
            newContent = newContent.replace(match, `apiResponse.success(${dataCapture})`);
            changed = true;
          }
        });
      }
    }

    return { content: newContent, changed };
  }

  private improveCatchBlocks(content: string): { content: string; changed: boolean } {
    let newContent = content;
    let changed = false;

    // Improve console.error patterns in catch blocks
    const consoleErrorPattern = /console\.error\(["`']([^"`']*)["`'],\s*(\w+)\);?/g;
    const matches = newContent.match(consoleErrorPattern);
    if (matches) {
      matches.forEach(match => {
        const improved = match.replace(
          /console\.error\(["`']([^"`']*)["`'],\s*(\w+)\);?/,
          'console.error("$1", toSafeError($2));'
        );
        newContent = newContent.replace(match, improved);
        changed = true;
      });
    }

    return { content: newContent, changed };
  }

  private printStats(): void {
    console.log('\n📊 Migration Statistics:');
    console.log('========================');
    console.log(`Files Processed: ${this.stats.filesProcessed}`);
    console.log(`API Routes Fixed: ${this.stats.apiRoutesFixed}`);
    console.log(`instanceof Replacements: ${this.stats.instanceofReplacements}`);
    console.log(`Imports Added: ${this.stats.importsAdded}`);
    
    if (this.stats.errorsFound.length > 0) {
      console.log('\n❌ Errors Found:');
      this.stats.errorsFound.forEach(error => console.log(`  - ${error}`));
    }
    
    console.log('\n✅ Migration completed!');
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Error Handling Migration Script

Usage:
  bun run scripts/migrate-error-handling.ts [options]

Options:
  --dry-run, -d    Run without making changes (preview mode)
  --help, -h       Show this help message

Examples:
  bun run scripts/migrate-error-handling.ts --dry-run
  bun run scripts/migrate-error-handling.ts
`);
    process.exit(0);
  }

  const migrator = new ErrorHandlingMigrator();
  
  try {
    await migrator.migrate(dryRun);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main().catch(console.error);
}

export { ErrorHandlingMigrator };