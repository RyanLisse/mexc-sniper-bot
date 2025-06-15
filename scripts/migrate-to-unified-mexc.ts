#!/usr/bin/env bun

/**
 * MEXC API Client Unification Migration Script
 * 
 * This script systematically migrates all MEXC API usages to the unified service layer.
 * It provides a safe, automated migration path with rollback capabilities.
 */

import { promises as fs } from "node:fs";
import { join } from "node:path";

interface MigrationRule {
  pattern: RegExp;
  replacement: string;
  description: string;
  fileTypes: string[];
}

interface MigrationStats {
  filesProcessed: number;
  filesChanged: number;
  replacementsMade: number;
  errors: string[];
  warnings: string[];
}

// Migration rules for updating imports and usage
const migrationRules: MigrationRule[] = [
  // Update imports to use unified exports
  {
    pattern: /import\s+\{\s*getMexcService\s*\}\s+from\s+["']@?\/src\/services\/mexc-service-layer["']/g,
    replacement: 'import { getRecommendedMexcService } from "@/src/services/mexc-unified-exports"',
    description: "Update getMexcService import to unified export",
    fileTypes: [".ts", ".tsx"],
  },
  {
    pattern: /import\s+\{\s*([^}]*,\s*)?getMexcService(\s*,[^}]*)?\s*\}\s+from\s+["']@?\/src\/services\/mexc-service-layer["']/g,
    replacement: 'import { $1getRecommendedMexcService$2 } from "@/src/services/mexc-unified-exports"',
    description: "Update getMexcService import with other imports to unified export",
    fileTypes: [".ts", ".tsx"],
  },
  
  // Update legacy client imports
  {
    pattern: /import\s+\{\s*([^}]*)\s*\}\s+from\s+["']@?\/src\/services\/mexc-api-client["']/g,
    replacement: 'import { $1 } from "@/src/services/mexc-unified-exports"',
    description: "Update legacy mexc-api-client imports to unified export",
    fileTypes: [".ts", ".tsx"],
  },
  {
    pattern: /import\s+\{\s*([^}]*)\s*\}\s+from\s+["']@?\/src\/services\/enhanced-mexc-api["']/g,
    replacement: 'import { $1 } from "@/src/services/mexc-unified-exports"',
    description: "Update legacy enhanced-mexc-api imports to unified export",
    fileTypes: [".ts", ".tsx"],
  },
  {
    pattern: /import\s+\{\s*([^}]*)\s*\}\s+from\s+["']@?\/src\/services\/mexc-trading-api["']/g,
    replacement: 'import { $1 } from "@/src/services/mexc-unified-exports"',
    description: "Update legacy mexc-trading-api imports to unified export",
    fileTypes: [".ts", ".tsx"],
  },
  
  // Update service instantiation
  {
    pattern: /const\s+mexcService\s*=\s*getMexcService\s*\(\s*([^)]*)\s*\)/g,
    replacement: 'const mexcService = getRecommendedMexcService($1)',
    description: "Update service instantiation to use recommended service",
    fileTypes: [".ts", ".tsx"],
  },
  {
    pattern: /getMexcService\s*\(\s*([^)]*)\s*\)/g,
    replacement: 'getRecommendedMexcService($1)',
    description: "Update direct service calls to use recommended service",
    fileTypes: [".ts", ".tsx"],
  },
  
  // Update type imports
  {
    pattern: /import\s+type\s+\{\s*([^}]*)\s*\}\s+from\s+["']@?\/src\/services\/mexc-service-layer["']/g,
    replacement: 'import type { $1 } from "@/src/services/mexc-unified-exports"',
    description: "Update type imports to unified export",
    fileTypes: [".ts", ".tsx"],
  },
];

class MexcMigrationTool {
  private stats: MigrationStats = {
    filesProcessed: 0,
    filesChanged: 0,
    replacementsMade: 0,
    errors: [],
    warnings: [],
  };

  private backupDir = join(process.cwd(), ".migration-backup");

  async run(dryRun = false): Promise<MigrationStats> {
    console.log("🚀 Starting MEXC API Client Unification Migration");
    console.log(`📁 Working directory: ${process.cwd()}`);
    console.log(`🔄 Mode: ${dryRun ? "DRY RUN" : "LIVE MIGRATION"}`);
    console.log("");

    if (!dryRun) {
      await this.createBackup();
    }

    const filesToProcess = await this.findFilesToMigrate();
    console.log(`📄 Found ${filesToProcess.length} files to process`);
    console.log("");

    for (const filePath of filesToProcess) {
      await this.processFile(filePath, dryRun);
    }

    this.printSummary();
    return this.stats;
  }

  private async createBackup(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`💾 Created backup directory: ${this.backupDir}`);
    } catch (error) {
      throw new Error(`Failed to create backup directory: ${error}`);
    }
  }

  private async findFilesToMigrate(): Promise<string[]> {
    const files: string[] = [];
    
    // Key directories to scan
    const scanDirs = [
      "src/mexc-agents",
      "src/services", 
      "src/hooks",
      "src/components",
      "app/api",
      "src/inngest",
      "tests",
    ];

    for (const dir of scanDirs) {
      const dirPath = join(process.cwd(), dir);
      try {
        const dirFiles = await this.scanDirectory(dirPath);
        files.push(...dirFiles);
      } catch (error) {
        this.stats.warnings.push(`Could not scan directory ${dir}: ${error}`);
      }
    }

    return files.filter(file => 
      file.endsWith(".ts") || file.endsWith(".tsx")
    );
  }

  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or no permission
    }
    
    return files;
  }

  private async processFile(filePath: string, dryRun: boolean): Promise<void> {
    try {
      this.stats.filesProcessed++;
      
      const content = await fs.readFile(filePath, "utf-8");
      let updatedContent = content;
      let fileChanged = false;
      let fileReplacements = 0;

      // Apply migration rules
      for (const rule of migrationRules) {
        const matches = updatedContent.match(rule.pattern);
        if (matches) {
          const newContent = updatedContent.replace(rule.pattern, rule.replacement);
          if (newContent !== updatedContent) {
            fileChanged = true;
            fileReplacements += matches.length;
            updatedContent = newContent;
            
            if (dryRun) {
              console.log(`  📝 ${rule.description} (${matches.length} matches)`);
            }
          }
        }
      }

      if (fileChanged) {
        this.stats.filesChanged++;
        this.stats.replacementsMade += fileReplacements;
        
        const relativePath = filePath.replace(process.cwd(), "");
        console.log(`${dryRun ? "📋" : "✅"} ${relativePath} (${fileReplacements} changes)`);

        if (!dryRun) {
          // Create backup
          const backupPath = join(this.backupDir, relativePath);
          await fs.mkdir(join(this.backupDir, relativePath.split("/").slice(0, -1).join("/")), { recursive: true });
          await fs.writeFile(backupPath, content);
          
          // Write updated file
          await fs.writeFile(filePath, updatedContent);
        }
      }
    } catch (error) {
      const relativePath = filePath.replace(process.cwd(), "");
      this.stats.errors.push(`Failed to process ${relativePath}: ${error}`);
      console.error(`❌ ${relativePath}: ${error}`);
    }
  }

  private printSummary(): void {
    console.log("");
    console.log("📊 Migration Summary");
    console.log("===================");
    console.log(`Files processed: ${this.stats.filesProcessed}`);
    console.log(`Files changed: ${this.stats.filesChanged}`);
    console.log(`Total replacements: ${this.stats.replacementsMade}`);
    console.log(`Errors: ${this.stats.errors.length}`);
    console.log(`Warnings: ${this.stats.warnings.length}`);

    if (this.stats.errors.length > 0) {
      console.log("");
      console.log("❌ Errors:");
      this.stats.errors.forEach(error => console.log(`  • ${error}`));
    }

    if (this.stats.warnings.length > 0) {
      console.log("");
      console.log("⚠️ Warnings:");
      this.stats.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    if (this.stats.filesChanged > 0) {
      console.log("");
      console.log("🎉 Migration completed successfully!");
      console.log(`📁 Backup created in: ${this.backupDir}`);
    } else {
      console.log("");
      console.log("ℹ️ No files needed migration.");
    }
  }

  async rollback(): Promise<void> {
    console.log("🔄 Rolling back migration...");
    
    try {
      const backupFiles = await this.scanDirectory(this.backupDir);
      
      for (const backupFile of backupFiles) {
        const relativePath = backupFile.replace(this.backupDir, "");
        const originalPath = join(process.cwd(), relativePath);
        
        const backupContent = await fs.readFile(backupFile, "utf-8");
        await fs.writeFile(originalPath, backupContent);
        
        console.log(`✅ Restored: ${relativePath}`);
      }
      
      // Remove backup directory
      await fs.rm(this.backupDir, { recursive: true });
      
      console.log("🎉 Migration rollback completed!");
    } catch (error) {
      console.error(`❌ Rollback failed: ${error}`);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const migrationTool = new MexcMigrationTool();
  
  try {
    switch (command) {
      case "dry-run":
        await migrationTool.run(true);
        break;
      case "migrate":
        await migrationTool.run(false);
        break;
      case "rollback":
        await migrationTool.rollback();
        break;
      default:
        console.log("MEXC API Client Unification Migration Tool");
        console.log("");
        console.log("Usage:");
        console.log("  bun migrate-to-unified-mexc.ts dry-run   # Preview changes");
        console.log("  bun migrate-to-unified-mexc.ts migrate   # Apply migration");
        console.log("  bun migrate-to-unified-mexc.ts rollback  # Rollback changes");
        console.log("");
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// CLI execution check
if (typeof require !== 'undefined' && require.main === module) {
  main();
}

export { MexcMigrationTool };