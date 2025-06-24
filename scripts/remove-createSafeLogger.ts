#!/usr/bin/env bun

/**
 * Bulk migration script to remove createSafeLogger imports and usage
 * Replaces with simple console logging or OpenTelemetry spans where appropriate
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

interface ReplacementRule {
  pattern: RegExp;
  replacement: string;
  description: string;
}

const replacementRules: ReplacementRule[] = [
  // Remove import statements
  {
    pattern: /import\s*{\s*createSafeLogger[^}]*}\s*from\s*["'][^"']*structured-logger["'];?\s*\n?/g,
    replacement: '',
    description: 'Remove createSafeLogger import'
  },
  
  // Remove logger type definitions
  {
    pattern: /private\s+?\s*\n?/g,
    replacement: '',
    description: 'Remove logger type definition'
  },
  
  // Remove logger property declarations
  {
    pattern: /(?:private|protected|public)?\s*]+;\s*\n?/g,
    replacement: '',
    description: 'Remove logger property'
  },
  
  // Remove logger initialization
  {
    pattern: /this\.logger\s*=\s*createSafeLogger\([^)]+\);\s*\n?/g,
    replacement: '',
    description: 'Remove logger initialization'
  },
  
  // Remove standalone logger creation
  {
    pattern: /const\s+logger\s*=\s*createSafeLogger\([^)]+\);\s*\n?/g,
    replacement: '',
    description: 'Remove standalone logger creation'
  },
  
  // Replace console.info() calls with console.info() for critical ones
  {
    pattern: /(?:this\.)?logger\.info\(/g,
    replacement: 'console.info(',
    description: 'Replace logger.info with console.info'
  },
  
  // Replace console.error() calls with console.error() for critical ones
  {
    pattern: /(?:this\.)?logger\.error\(/g,
    replacement: 'console.error(',
    description: 'Replace logger.error with console.error'
  },
  
  // Replace console.warn() calls with console.warn()
  {
    pattern: /(?:this\.)?logger\.warn\(/g,
    replacement: 'console.warn(',
    description: 'Replace logger.warn with console.warn'
  },
  
  // Remove logger.debug() calls entirely (debug not essential)
  {
    pattern: /\s*(?:this\.)?logger\.debug\([^)]*\);\s*\n?/g,
    replacement: '',
    description: 'Remove logger.debug calls'
  },
  
  // Remove other logger method calls (trading, pattern, api, etc.) - not essential
  {
    pattern: /\s*(?:this\.)?logger\.(?:trading|pattern|api|agent|performance|cache|safety)\([^)]*\);\s*\n?/g,
    replacement: '',
    description: 'Remove specialized logger method calls'
  }
];

function processFile(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Apply all replacement rules
    for (const rule of replacementRules) {
      const originalContent = content;
      content = content.replace(rule.pattern, rule.replacement);
      if (content !== originalContent) {
        modified = true;
        console.log(`  ✓ Applied: ${rule.description}`);
      }
    }
    
    // Clean up multiple empty lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other unwanted directories
        if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(entry)) {
          files.push(...findTypeScriptFiles(fullPath));
        }
      } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

function main() {
  const projectRoot = process.cwd();
  console.log(`🚀 Starting createSafeLogger removal from: ${projectRoot}`);
  
  // Find all TypeScript files
  const tsFiles = findTypeScriptFiles(projectRoot);
  console.log(`📁 Found ${tsFiles.length} TypeScript files`);
  
  let processedCount = 0;
  let modifiedCount = 0;
  
  for (const file of tsFiles) {
    // Skip the structured-logger.ts file itself (we'll handle it separately)
    if (file.includes('structured-logger.ts')) {
      continue;
    }
    
    // Check if file contains createSafeLogger
    const content = readFileSync(file, 'utf-8');
    if (content.includes('createSafeLogger')) {
      console.log(`\n📝 Processing: ${file.replace(projectRoot, '.')}`);
      
      if (processFile(file)) {
        modifiedCount++;
      }
      
      processedCount++;
    }
  }
  
  console.log(`\n✅ Migration complete:`);
  console.log(`   📊 Files processed: ${processedCount}`);
  console.log(`   🔧 Files modified: ${modifiedCount}`);
  console.log(`   ⏭️  Next steps: Review changes and test build`);
}

if (import.meta.main) {
  main();
}