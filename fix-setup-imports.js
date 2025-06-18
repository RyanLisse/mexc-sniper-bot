#!/usr/bin/env node

/**
 * Script to fix @/src imports in test setup files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup files to process
const setupFiles = [
  path.join(__dirname, 'tests/setup/vitest-setup.js'),
  path.join(__dirname, 'tests/setup/global-setup.js')
];

// Function to process a single setup file
function processSetupFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    
    // Replace @/src/ imports with relative paths
    // For setup files, we need to go up from tests/setup/ to project root
    const updatedContent = content.replace(
      /from ['"']@\/src\/([^'"']+)['"']/g,
      (match, importPath) => {
        hasChanges = true;
        // Remove .js/.ts extension if present for cleaner paths
        const cleanPath = importPath.replace(/\.(js|ts|jsx|tsx)$/, '');
        // From tests/setup/ we need ../../src/
        return `from '../../src/${cleanPath}'`;
      }
    );
    
    // Also handle import() statements
    const finalContent = updatedContent.replace(
      /import\(['"']@\/src\/([^'"']+)['"']\)/g,
      (match, importPath) => {
        hasChanges = true;
        // Remove .js/.ts extension if present
        const cleanPath = importPath.replace(/\.(js|ts|jsx|tsx)$/, '');
        // From tests/setup/ we need ../../src/
        return `import('../../src/${cleanPath}')`;
      }
    );
    
    if (hasChanges) {
      fs.writeFileSync(filePath, finalContent, 'utf8');
      console.log(`✅ Fixed setup imports in: ${path.relative(__dirname, filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main execution
function main() {
  console.log('🔧 Starting setup file import fixing...\n');
  
  let totalFiles = 0;
  let fixedFiles = 0;
  
  for (const filePath of setupFiles) {
    console.log(`📁 Processing setup file: ${path.relative(__dirname, filePath)}`);
    totalFiles++;
    
    if (processSetupFile(filePath)) {
      fixedFiles++;
    }
  }
  
  console.log(`\n🎉 Setup import fixing completed!`);
  console.log(`📊 Setup files processed: ${totalFiles}`);
  console.log(`✅ Setup files fixed: ${fixedFiles}`);
  console.log(`📋 Setup files unchanged: ${totalFiles - fixedFiles}`);
}

main();