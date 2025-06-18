#!/usr/bin/env node

/**
 * Script to fix @/src imports to relative imports
 * This will convert all @/src/ imports to relative paths
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directories to process
const sourceDirectories = [
  path.join(__dirname, 'src'),
  path.join(__dirname, 'app')
];

// File extensions to process
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

// Function to get relative path between two directories
function getRelativePath(fromFile, toFile) {
  const fromDir = path.dirname(fromFile);
  const relativePath = path.relative(fromDir, toFile);
  
  // Ensure the path starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    return './' + relativePath;
  }
  return relativePath;
}

// Function to process a single file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    
    // Replace @/src/ imports with relative paths
    const updatedContent = content.replace(
      /from ["']@\/src\/([^"']+)["']/g,
      (match, importPath) => {
        hasChanges = true;
        
        // Calculate relative path from current file to target
        const targetPath = path.join(__dirname, 'src', importPath);
        const relativePath = getRelativePath(filePath, targetPath);
        
        // Remove .ts/.tsx extension if present (TypeScript auto-resolves)
        const cleanPath = relativePath.replace(/\.(ts|tsx)$/, '');
        
        return `from "${cleanPath}"`;
      }
    );
    
    // Also handle import statements
    const finalContent = updatedContent.replace(
      /import (.+) from ["']@\/src\/([^"']+)["']/g,
      (match, importStatement, importPath) => {
        hasChanges = true;
        
        // Calculate relative path from current file to target
        const targetPath = path.join(__dirname, 'src', importPath);
        const relativePath = getRelativePath(filePath, targetPath);
        
        // Remove .ts/.tsx extension if present
        const cleanPath = relativePath.replace(/\.(ts|tsx)$/, '');
        
        return `import ${importStatement} from "${cleanPath}"`;
      }
    );
    
    if (hasChanges) {
      fs.writeFileSync(filePath, finalContent, 'utf8');
      console.log(`✅ Fixed imports in: ${path.relative(__dirname, filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Function to recursively find files
function findFiles(dir, extensions) {
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
          if (extensions.includes(ext)) {
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
  console.log('🔧 Starting import path fixing...\n');
  
  let totalFiles = 0;
  let fixedFiles = 0;
  
  for (const dir of sourceDirectories) {
    console.log(`📁 Processing directory: ${path.relative(__dirname, dir)}`);
    
    const files = findFiles(dir, extensions);
    totalFiles += files.length;
    
    for (const file of files) {
      if (processFile(file)) {
        fixedFiles++;
      }
    }
    
    console.log('');
  }
  
  console.log(`🎉 Import fixing completed!`);
  console.log(`📊 Files processed: ${totalFiles}`);
  console.log(`✅ Files fixed: ${fixedFiles}`);
  console.log(`📋 Files unchanged: ${totalFiles - fixedFiles}`);
}

main();