#!/usr/bin/env node

/**
 * Script to fix @/src imports in test files
 * This will convert all @/src/ imports to relative paths in test files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test directories to process
const testDirectories = [
  path.join(__dirname, 'tests')
];

// File extensions to process
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

// Function to get relative path from test file to src file
function getRelativePathToSrc(fromTestFile, srcPath) {
  const fromDir = path.dirname(fromTestFile);
  
  // Calculate how many levels up to get to project root
  const relativeParts = path.relative(__dirname, fromDir).split(path.sep);
  const levelsUp = relativeParts.length;
  
  // Create relative path to src
  const upPath = '../'.repeat(levelsUp);
  const targetPath = path.join(upPath, 'src', srcPath);
  
  // Normalize the path
  return targetPath.replace(/\\/g, '/');
}

// Function to process a single test file
function processTestFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    
    // Replace @/src/ imports with relative paths
    const updatedContent = content.replace(
      /from ["']@\/src\/([^"']+)["']/g,
      (match, importPath) => {
        hasChanges = true;
        const relativePath = getRelativePathToSrc(filePath, importPath);
        // Remove .ts/.tsx extension if present
        const cleanPath = relativePath.replace(/\.(ts|tsx)$/, '');
        return `from "${cleanPath}"`;
      }
    );
    
    // Also handle import statements
    const finalContent = updatedContent.replace(
      /import (.+) from ["']@\/src\/([^"']+)["']/g,
      (match, importStatement, importPath) => {
        hasChanges = true;
        const relativePath = getRelativePathToSrc(filePath, importPath);
        // Remove .ts/.tsx extension if present
        const cleanPath = relativePath.replace(/\.(ts|tsx)$/, '');
        return `import ${importStatement} from "${cleanPath}"`;
      }
    );
    
    if (hasChanges) {
      fs.writeFileSync(filePath, finalContent, 'utf8');
      console.log(`✅ Fixed test imports in: ${path.relative(__dirname, filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Function to recursively find test files
function findTestFiles(dir, extensions) {
  const files = [];
  
  function traverse(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip node_modules and other unwanted directories
          if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(item)) {
            traverse(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(fullPath);
          if (extensions.includes(ext) && fullPath.includes('.test.')) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Cannot read directory ${currentDir}:`, error.message);
    }
  }
  
  traverse(dir);
  return files;
}

// Main execution
function main() {
  console.log('🔧 Starting test import path fixing...\n');
  
  let totalFiles = 0;
  let fixedFiles = 0;
  
  for (const dir of testDirectories) {
    console.log(`📁 Processing test directory: ${path.relative(__dirname, dir)}`);
    
    const files = findTestFiles(dir, extensions);
    totalFiles += files.length;
    
    for (const file of files) {
      if (processTestFile(file)) {
        fixedFiles++;
      }
    }
    
    console.log('');
  }
  
  console.log(`🎉 Test import fixing completed!`);
  console.log(`📊 Test files processed: ${totalFiles}`);
  console.log(`✅ Test files fixed: ${fixedFiles}`);
  console.log(`📋 Test files unchanged: ${totalFiles - fixedFiles}`);
}

main();