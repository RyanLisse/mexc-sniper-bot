#!/usr/bin/env tsx
/**
 * Bundle Analysis Utility
 * Tracks bundle size improvements and generates reports
 * Part of Task 5.1: Bundle Size Optimization
 */

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface BundleStats {
  timestamp: string;
  totalSize: number;
  gzippedSize: number;
  files: {
    name: string;
    size: number;
    gzippedSize?: number;
    type: 'js' | 'css' | 'other';
  }[];
  chunks: {
    name: string;
    size: number;
    modules: string[];
  }[];
}

interface BundleComparison {
  before: BundleStats;
  after: BundleStats;
  improvement: {
    totalSizeReduction: number;
    totalSizeReductionPercent: number;
    gzippedSizeReduction: number;
    gzippedSizeReductionPercent: number;
    largestImprovements: Array<{
      file: string;
      beforeSize: number;
      afterSize: number;
      reduction: number;
      reductionPercent: number;
    }>;
  };
}

class BundleAnalyzer {
  private readonly buildDir = '.next';
  private readonly staticDir = join(this.buildDir, 'static');
  private readonly reportDir = 'bundle-reports';

  async analyzeBuild(): Promise<BundleStats> {
    if (!existsSync(this.buildDir)) {
      throw new Error('Build directory not found. Please run "npm run build" first.');
    }

    const files = await this.getStaticFiles();
    const chunks = await this.getChunkInfo();
    
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const gzippedSize = files.reduce((sum, file) => sum + (file.gzippedSize || 0), 0);

    return {
      timestamp: new Date().toISOString(),
      totalSize,
      gzippedSize,
      files,
      chunks
    };
  }

  private async getStaticFiles(): Promise<BundleStats['files']> {
    const files: BundleStats['files'] = [];
    
    if (!existsSync(this.staticDir)) {
      return files;
    }

    const staticDirs = await readdir(this.staticDir);
    
    for (const dir of staticDirs) {
      const dirPath = join(this.staticDir, dir);
      const dirStat = await stat(dirPath);
      
      if (dirStat.isDirectory()) {
        const dirFiles = await readdir(dirPath);
        
        for (const fileName of dirFiles) {
          const filePath = join(dirPath, fileName);
          const fileStat = await stat(filePath);
          
          if (fileStat.isFile()) {
            const fileType = this.getFileType(fileName);
            
            files.push({
              name: `${dir}/${fileName}`,
              size: fileStat.size,
              type: fileType
            });
          }
        }
      }
    }

    return files.sort((a, b) => b.size - a.size);
  }

  private async getChunkInfo(): Promise<BundleStats['chunks']> {
    const chunks: BundleStats['chunks'] = [];
    
    // Try to read webpack stats if available
    const statsPath = join(this.buildDir, 'webpack-stats.json');
    if (existsSync(statsPath)) {
      try {
        const statsContent = await readFile(statsPath, 'utf-8');
        const stats = JSON.parse(statsContent);
        
        if (stats.chunks) {
          for (const chunk of stats.chunks) {
            chunks.push({
              name: chunk.name || chunk.id,
              size: chunk.size || 0,
              modules: chunk.modules?.map((m: any) => m.name || m.id) || []
            });
          }
        }
      } catch (error) {
        console.warn('Could not parse webpack stats:', error);
      }
    }

    return chunks;
  }

  private getFileType(fileName: string): 'js' | 'css' | 'other' {
    if (fileName.endsWith('.js')) return 'js';
    if (fileName.endsWith('.css')) return 'css';
    return 'other';
  }

  async saveReport(stats: BundleStats, filename?: string): Promise<string> {
    if (!existsSync(this.reportDir)) {
      await import('fs').then(fs => 
        fs.promises.mkdir(this.reportDir, { recursive: true })
      );
    }

    const reportFilename = filename || `bundle-analysis-${Date.now()}.json`;
    const reportPath = join(this.reportDir, reportFilename);
    
    await writeFile(reportPath, JSON.stringify(stats, null, 2));
    
    return reportPath;
  }

  async compareReports(beforePath: string, afterPath: string): Promise<BundleComparison> {
    const beforeContent = await readFile(beforePath, 'utf-8');
    const afterContent = await readFile(afterPath, 'utf-8');
    
    const before: BundleStats = JSON.parse(beforeContent);
    const after: BundleStats = JSON.parse(afterContent);

    const totalSizeReduction = before.totalSize - after.totalSize;
    const totalSizeReductionPercent = (totalSizeReduction / before.totalSize) * 100;
    
    const gzippedSizeReduction = before.gzippedSize - after.gzippedSize;
    const gzippedSizeReductionPercent = (gzippedSizeReduction / before.gzippedSize) * 100;

    // Find largest file-level improvements
    const largestImprovements: BundleComparison['improvement']['largestImprovements'] = [];
    
    for (const beforeFile of before.files) {
      const afterFile = after.files.find(f => f.name === beforeFile.name);
      if (afterFile) {
        const reduction = beforeFile.size - afterFile.size;
        const reductionPercent = (reduction / beforeFile.size) * 100;
        
        if (reduction > 0) {
          largestImprovements.push({
            file: beforeFile.name,
            beforeSize: beforeFile.size,
            afterSize: afterFile.size,
            reduction,
            reductionPercent
          });
        }
      }
    }

    largestImprovements.sort((a, b) => b.reduction - a.reduction);

    return {
      before,
      after,
      improvement: {
        totalSizeReduction,
        totalSizeReductionPercent,
        gzippedSizeReduction,
        gzippedSizeReductionPercent,
        largestImprovements: largestImprovements.slice(0, 10) // Top 10
      }
    };
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  generateReport(stats: BundleStats): string {
    let report = `# Bundle Analysis Report\n\n`;
    report += `**Generated:** ${new Date(stats.timestamp).toLocaleString()}\n\n`;
    report += `## Summary\n\n`;
    report += `- **Total Size:** ${this.formatBytes(stats.totalSize)}\n`;
    report += `- **Gzipped Size:** ${this.formatBytes(stats.gzippedSize)}\n`;
    report += `- **Total Files:** ${stats.files.length}\n`;
    report += `- **Total Chunks:** ${stats.chunks.length}\n\n`;

    report += `## Largest Files\n\n`;
    report += `| File | Size | Type |\n`;
    report += `|------|------|------|\n`;
    
    for (const file of stats.files.slice(0, 20)) {
      report += `| ${file.name} | ${this.formatBytes(file.size)} | ${file.type} |\n`;
    }

    if (stats.chunks.length > 0) {
      report += `\n## Chunks\n\n`;
      report += `| Chunk | Size | Modules |\n`;
      report += `|-------|------|----------|\n`;
      
      for (const chunk of stats.chunks.slice(0, 10)) {
        report += `| ${chunk.name} | ${this.formatBytes(chunk.size)} | ${chunk.modules.length} |\n`;
      }
    }

    return report;
  }

  generateComparisonReport(comparison: BundleComparison): string {
    const { improvement } = comparison;
    
    let report = `# Bundle Size Optimization Results\n\n`;
    report += `**Analysis Date:** ${new Date().toLocaleString()}\n\n`;
    
    report += `## 🎯 Overall Results\n\n`;
    report += `- **Total Size Reduction:** ${this.formatBytes(improvement.totalSizeReduction)} (${improvement.totalSizeReductionPercent.toFixed(2)}%)\n`;
    report += `- **Gzipped Size Reduction:** ${this.formatBytes(improvement.gzippedSizeReduction)} (${improvement.gzippedSizeReductionPercent.toFixed(2)}%)\n\n`;

    if (improvement.totalSizeReductionPercent >= 30) {
      report += `✅ **SUCCESS:** Achieved ${improvement.totalSizeReductionPercent.toFixed(1)}% reduction - exceeding 30% target!\n\n`;
    } else if (improvement.totalSizeReductionPercent >= 20) {
      report += `🔶 **GOOD PROGRESS:** Achieved ${improvement.totalSizeReductionPercent.toFixed(1)}% reduction - approaching 30% target\n\n`;
    } else {
      report += `🔴 **NEEDS IMPROVEMENT:** Only ${improvement.totalSizeReductionPercent.toFixed(1)}% reduction - target is 30%\n\n`;
    }

    report += `## 📊 Before vs After\n\n`;
    report += `| Metric | Before | After | Improvement |\n`;
    report += `|--------|---------|-------|-------------|\n`;
    report += `| Total Size | ${this.formatBytes(comparison.before.totalSize)} | ${this.formatBytes(comparison.after.totalSize)} | ${this.formatBytes(improvement.totalSizeReduction)} |\n`;
    report += `| Gzipped Size | ${this.formatBytes(comparison.before.gzippedSize)} | ${this.formatBytes(comparison.after.gzippedSize)} | ${this.formatBytes(improvement.gzippedSizeReduction)} |\n`;
    report += `| File Count | ${comparison.before.files.length} | ${comparison.after.files.length} | ${comparison.before.files.length - comparison.after.files.length} |\n\n`;

    if (improvement.largestImprovements.length > 0) {
      report += `## 🏆 Largest File Improvements\n\n`;
      report += `| File | Before | After | Reduction |\n`;
      report += `|------|--------|-------|----------|\n`;
      
      for (const imp of improvement.largestImprovements.slice(0, 10)) {
        report += `| ${imp.file} | ${this.formatBytes(imp.beforeSize)} | ${this.formatBytes(imp.afterSize)} | ${this.formatBytes(imp.reduction)} (${imp.reductionPercent.toFixed(1)}%) |\n`;
      }
    }

    return report;
  }
}

// CLI Interface
async function main() {
  const analyzer = new BundleAnalyzer();
  const command = process.argv[2];

  try {
    switch (command) {
      case 'analyze':
        console.log('Analyzing bundle...');
        const stats = await analyzer.analyzeBuild();
        const reportPath = await analyzer.saveReport(stats);
        console.log(`Bundle analysis saved to: ${reportPath}`);
        console.log('\nBundle Summary:');
        console.log(`Total Size: ${analyzer.formatBytes(stats.totalSize)}`);
        console.log(`Gzipped Size: ${analyzer.formatBytes(stats.gzippedSize)}`);
        console.log(`Files: ${stats.files.length}`);
        break;

      case 'compare':
        const beforePath = process.argv[3];
        const afterPath = process.argv[4];
        
        if (!beforePath || !afterPath) {
          console.error('Usage: bundle-analysis compare <before-report> <after-report>');
          process.exit(1);
        }
        
        const comparison = await analyzer.compareReports(beforePath, afterPath);
        const comparisonReport = analyzer.generateComparisonReport(comparison);
        
        console.log(comparisonReport);
        
        const comparisonPath = join('bundle-reports', `comparison-${Date.now()}.md`);
        await writeFile(comparisonPath, comparisonReport);
        console.log(`\nComparison report saved to: ${comparisonPath}`);
        break;

      default:
        console.log('Usage:');
        console.log('  tsx scripts/bundle-analysis.ts analyze');
        console.log('  tsx scripts/bundle-analysis.ts compare <before-report> <after-report>');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { BundleAnalyzer };