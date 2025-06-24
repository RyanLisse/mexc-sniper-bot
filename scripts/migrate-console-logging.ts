#!/usr/bin/env bun
/**
 * Console Logging Migration Script
 * 
 * This script automatically migrates console.log/warn/error statements
 * to structured logging using the createLogger system.
 * 
 * Identified Issues:
 * - 1,540 console statements in src/
 * - 305 console statements in app/
 * - Total: 1,845 statements across 235+ files
 * 
 * Migration Strategy:
 * 1. Add createLogger import if missing
 * 2. Replace console.log with logger.info
 * 3. Replace console.warn with logger.warn  
 * 4. Replace console.error with logger.error
 * 5. Replace console.debug with logger.debug
 * 6. Preserve context and formatting
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';

interface MigrationStats {
  filesProcessed: number;
  consoleStatementsReplaced: number;
  errorsEncountered: number;
  filesWithLoggerAdded: number;
}

interface FileAnalysis {
  filePath: string;
  consoleStatements: number;
  hasCreateLoggerImport: boolean;
  hasLoggerDeclaration: boolean;
  suggestedLoggerName: string;
}

const stats: MigrationStats = {
  filesProcessed: 0,
  consoleStatementsReplaced: 0,
  errorsEncountered: 0,
  filesWithLoggerAdded: 0
};

// ============================================================================
// File Discovery
// ============================================================================

async function findTypeScriptFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await readdir(dirPath);
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const statInfo = await stat(fullPath);
      
      if (statInfo.isDirectory()) {
        // Skip node_modules and other irrelevant directories
        if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(entry)) {
          files.push(...await findTypeScriptFiles(fullPath));
        }
      } else if (statInfo.isFile() && ['.ts', '.tsx'].includes(extname(entry))) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }
  
  return files;
}

// ============================================================================
// File Analysis
// ============================================================================

async function analyzeFile(filePath: string): Promise<FileAnalysis | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    
    // Count console statements
    const consoleMatches = content.match(/console\.(log|warn|error|debug|info)/g);
    const consoleStatements = consoleMatches?.length || 0;
    
    // Skip files without console statements
    if (consoleStatements === 0) {
      return null;
    }
    
    // Check for existing createLogger import
    const hasCreateLoggerImport = /import.*createLogger.*from.*structured-logger/.test(content);
    
    // Check for existing logger declaration
    const hasLoggerDeclaration = /(?:const|let)\s+\w*[Ll]ogger\s*=/.test(content);
    
    // Suggest logger name based on file context
    const fileName = filePath.split('/').pop()?.replace(/\.(ts|tsx)$/, '') || 'unknown';
    const suggestedLoggerName = fileName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
    
    return {
      filePath,
      consoleStatements,
      hasCreateLoggerImport,
      hasLoggerDeclaration,
      suggestedLoggerName
    };
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error);
    stats.errorsEncountered++;
    return null;
  }
}

// ============================================================================
// Code Migration
// ============================================================================

async function migrateFile(analysis: FileAnalysis): Promise<void> {
  try {
    let content = await readFile(analysis.filePath, 'utf-8');
    let modified = false;
    
    // Add createLogger import if missing
    if (!analysis.hasCreateLoggerImport) {
      // Find the best place to add the import
      const importLines = content.split('\n').filter(line => line.trim().startsWith('import'));
      const lastImportIndex = content.lastIndexOf(importLines[importLines.length - 1] || '');
      
      if (lastImportIndex !== -1) {
        const insertPoint = content.indexOf('\n', lastImportIndex) + 1;
        const loggerImport = `import { createLogger } from '../lib/structured-logger';\n`;
        content = content.slice(0, insertPoint) + loggerImport + content.slice(insertPoint);
        modified = true;
        stats.filesWithLoggerAdded++;
      }
    }
    
    // Add logger declaration if missing
    if (!analysis.hasLoggerDeclaration) {
      // Find a good place to add the logger declaration
      // Look for class declaration or first function
      const classMatch = content.match(/^(export\s+)?class\s+\w+/m);
      const functionMatch = content.match(/^(export\s+)?(async\s+)?function\s+\w+/m);
      
      let insertPoint = -1;
      let loggerDeclaration = '';
      
      if (classMatch) {
        // Add as private class property
        const classStart = content.indexOf(classMatch[0]);
        const classBodyStart = content.indexOf('{', classStart) + 1;
        insertPoint = classBodyStart;
        loggerDeclaration = `\n  private logger = createLogger('${analysis.suggestedLoggerName}');\n`;
      } else if (functionMatch) {
        // Add as module-level constant
        const functionStart = content.indexOf(functionMatch[0]);
        insertPoint = functionStart;
        loggerDeclaration = `const logger = createLogger('${analysis.suggestedLoggerName}');\n\n`;
      } else {
        // Add at the top after imports
        const lastImport = content.lastIndexOf('import');
        if (lastImport !== -1) {
          const nextLine = content.indexOf('\n', lastImport);
          insertPoint = nextLine + 1;
          loggerDeclaration = `\nconst logger = createLogger('${analysis.suggestedLoggerName}');\n`;
        }
      }
      
      if (insertPoint !== -1) {
        content = content.slice(0, insertPoint) + loggerDeclaration + content.slice(insertPoint);
        modified = true;
      }
    }
    
    // Replace console statements with logger calls
    let replacementCount = 0;
    
    // Define replacement patterns
    const replacements = [
      {
        pattern: /console\.log\s*\(/g,
        replacement: 'logger.info(',
        logLevel: 'info'
      },
      {
        pattern: /console\.warn\s*\(/g,
        replacement: 'logger.warn(',
        logLevel: 'warn'
      },
      {
        pattern: /console\.error\s*\(/g,
        replacement: 'logger.error(',
        logLevel: 'error'
      },
      {
        pattern: /console\.debug\s*\(/g,
        replacement: 'logger.debug(',
        logLevel: 'debug'
      },
      {
        pattern: /console\.info\s*\(/g,
        replacement: 'logger.info(',
        logLevel: 'info'
      }
    ];
    
    // Apply replacements
    for (const { pattern, replacement } of replacements) {
      const beforeCount = (content.match(pattern) || []).length;
      content = content.replace(pattern, replacement);
      const afterCount = (content.match(pattern) || []).length;
      replacementCount += beforeCount - afterCount;
    }
    
    if (replacementCount > 0) {
      modified = true;
      stats.consoleStatementsReplaced += replacementCount;
    }
    
    // Write file if modified
    if (modified) {
      await writeFile(analysis.filePath, content, 'utf-8');
      console.log(`✅ Migrated ${analysis.filePath}: ${replacementCount} console statements replaced`);
    }
    
    stats.filesProcessed++;
    
  } catch (error) {
    console.error(`❌ Error migrating file ${analysis.filePath}:`, error);
    stats.errorsEncountered++;
  }
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  console.log('🚀 Starting Console Logging Migration...\n');
  
  const startTime = Date.now();
  
  // Find all TypeScript files
  console.log('📁 Discovering TypeScript files...');
  const srcFiles = await findTypeScriptFiles('./src');
  const appFiles = await findTypeScriptFiles('./app');
  const allFiles = [...srcFiles, ...appFiles];
  
  console.log(`Found ${allFiles.length} TypeScript files\n`);
  
  // Analyze files for console statements
  console.log('🔍 Analyzing files for console statements...');
  const analyses: FileAnalysis[] = [];
  
  for (const filePath of allFiles) {
    const analysis = await analyzeFile(filePath);
    if (analysis) {
      analyses.push(analysis);
    }
  }
  
  console.log(`Found ${analyses.length} files with console statements`);
  console.log(`Total console statements to migrate: ${analyses.reduce((sum, a) => sum + a.consoleStatements, 0)}\n`);
  
  // Show top 10 files with most console statements
  const topFiles = analyses
    .sort((a, b) => b.consoleStatements - a.consoleStatements)
    .slice(0, 10);
    
  console.log('📊 Top 10 files with most console statements:');
  topFiles.forEach((analysis, index) => {
    console.log(`${index + 1}. ${analysis.filePath.replace('./src/', '').replace('./app/', '')}: ${analysis.consoleStatements} statements`);
  });
  console.log();
  
  // Perform migration
  console.log('🔧 Starting migration...');
  
  for (const analysis of analyses) {
    await migrateFile(analysis);
  }
  
  // Print final statistics
  const duration = Date.now() - startTime;
  
  console.log('\n📈 Migration Complete!');
  console.log('==========================================');
  console.log(`Files processed: ${stats.filesProcessed}`);
  console.log(`Console statements replaced: ${stats.consoleStatementsReplaced}`);
  console.log(`Files with logger added: ${stats.filesWithLoggerAdded}`);
  console.log(`Errors encountered: ${stats.errorsEncountered}`);
  console.log(`Duration: ${duration}ms`);
  console.log('==========================================');
  
  if (stats.errorsEncountered > 0) {
    console.log('\n⚠️  Some errors were encountered during migration.');
    console.log('Please review the error messages above and manually fix any issues.');
  }
  
  console.log('\n✨ Next Steps:');
  console.log('1. Review the migrated files to ensure logging context is preserved');
  console.log('2. Run tests to verify functionality');
  console.log('3. Commit the changes');
  console.log('4. Update any remaining console statements in test files if needed');
}

// Run the migration
if (require.main === module) {
  main().catch(console.error);
}

export { main as runConsoleMigration };