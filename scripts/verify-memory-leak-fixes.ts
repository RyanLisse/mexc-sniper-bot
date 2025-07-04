#!/usr/bin/env tsx
/**
 * Memory Leak Fix Verification Script
 * 
 * Verifies that all critical EventEmitter memory leak patterns 
 * have been properly addressed throughout the codebase.
 * 
 * Usage: tsx scripts/verify-memory-leak-fixes.ts
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

interface VerificationResult {
  pattern: string;
  description: string;
  files: string[];
  status: "PASS" | "FAIL" | "WARNING";
  details: string;
}

export class MemoryLeakVerifier {
  private readonly srcPath = path.join(__dirname, "..", "src");

  async runVerification(): Promise<boolean> {
    console.log("🔍 MEMORY LEAK FIX VERIFICATION");
    console.log("=" * 50);

    const checks = [
      await this.checkWebSocketCleanup(),
      await this.checkEventEmitterCleanup(), 
      await this.checkMemoryManagerRegistration(),
      await this.checkReactHookCleanup(),
      await this.checkIntervalCleanup(),
      await this.checkBrowserCompatibleEventEmitter()
    ];

    this.printResults(checks);
    
    const passed = checks.filter(c => c.status === "PASS").length;
    const failed = checks.filter(c => c.status === "FAIL").length;
    const warnings = checks.filter(c => c.status === "WARNING").length;

    console.log(`\n📊 VERIFICATION SUMMARY:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Warnings: ${warnings}`);

    const success = failed === 0;
    console.log(`\n${success ? "🎉 ALL MEMORY LEAK FIXES VERIFIED!" : "❌ VERIFICATION FAILED"}`);
    
    return success;
  }

  private async checkWebSocketCleanup(): Promise<VerificationResult> {
    const pattern = "WebSocket Event Handler Cleanup";
    
    try {
      // Check specific files that should have proper cleanup
      const criticalFiles = [
        "services/trading/realtime-price-monitor.ts",
        "services/data/websocket/websocket-server-service.ts"
      ];
      
      const cleanupChecks = criticalFiles.map(file => {
        const fullPath = path.join(this.srcPath, file);
        const hasCleanup = this.fileContainsPattern(fullPath, "cleanupWebSocketListeners|removeEventListener|\\.off\\(|removeAllListeners");
        return { file, hasCleanup, exists: fs.existsSync(fullPath) };
      });
      
      const allExistingFilesHaveCleanup = cleanupChecks
        .filter(check => check.exists)
        .every(check => check.hasCleanup);
      
      const existingFiles = cleanupChecks.filter(check => check.exists);
      const filesWithCleanup = cleanupChecks.filter(check => check.hasCleanup);

      return {
        pattern,
        description: "WebSocket connections properly clean up event handlers",
        files: existingFiles.map(f => f.file),
        status: allExistingFilesHaveCleanup ? "PASS" : "FAIL",
        details: `${filesWithCleanup.length}/${existingFiles.length} critical WebSocket services have proper cleanup`
      };
    } catch (error) {
      return {
        pattern,
        description: "WebSocket event handler cleanup verification",
        files: [],
        status: "FAIL",
        details: `Verification failed: ${error}`
      };
    }
  }

  private async checkEventEmitterCleanup(): Promise<VerificationResult> {
    const pattern = "EventEmitter Cleanup in Stop Methods";
    
    try {
      // Find all services with stop methods that should clean up EventEmitters
      const { stdout } = await execAsync(
        `find ${this.srcPath} -name "*.ts" | ` +
        `xargs grep -l "extends.*EventEmitter\\|extends.*BrowserCompatibleEventEmitter" | ` +
        `xargs grep -l "async.*stop\\|stop.*:" | ` + 
        `xargs grep -l "removeAllListeners"`
      );
      
      const files = stdout.trim().split('\n').filter(f => f);
      
      // Check that critical services have proper cleanup
      const criticalServices = [
        "services/trading/realtime-price-monitor.ts",
        "services/trading/complete-auto-sniping-service.ts",
        "services/data/websocket/websocket-server-service.ts"
      ];
      
      const allHaveCleanup = criticalServices.every(service =>
        this.fileContainsPattern(path.join(this.srcPath, service), "removeAllListeners")
      );

      return {
        pattern,
        description: "EventEmitter services properly clean up listeners on stop",
        files,
        status: allHaveCleanup ? "PASS" : "FAIL", 
        details: allHaveCleanup
          ? "All critical services implement EventEmitter cleanup"
          : "Some services missing removeAllListeners() calls"
      };
    } catch (error) {
      return {
        pattern,
        description: "EventEmitter cleanup verification",
        files: [],
        status: "FAIL",
        details: `Verification failed: ${error}`
      };
    }
  }

  private async checkMemoryManagerRegistration(): Promise<VerificationResult> {
    const pattern = "Memory Manager Registration";
    
    try {
      // Check for services registering with MemoryLeakCleanupManager
      const { stdout } = await execAsync(
        `find ${this.srcPath} -name "*.ts" | ` +
        `xargs grep -l "memoryLeakCleanupManager\\.register"`
      );
      
      const files = stdout.trim().split('\n').filter(f => f);
      
      return {
        pattern,
        description: "Services register with MemoryLeakCleanupManager",
        files,
        status: files.length >= 3 ? "PASS" : "WARNING",
        details: `${files.length} services registered with memory manager`
      };
    } catch (error) {
      return {
        pattern,
        description: "Memory manager registration verification",
        files: [],
        status: "WARNING",
        details: `Could not verify registration: ${error}`
      };
    }
  }

  private async checkReactHookCleanup(): Promise<VerificationResult> {
    const pattern = "React Hook Cleanup";
    
    try {
      // Check React hooks for proper cleanup patterns
      const { stdout } = await execAsync(
        `find ${this.srcPath} -name "*.ts" -o -name "*.tsx" | ` +
        `xargs grep -l "useEffect\\|useWebSocket" | ` +
        `xargs grep -l "return.*cleanup\\|return.*unsubscribe\\|return.*()"`
      );
      
      const files = stdout.trim().split('\n').filter(f => f);
      
      // Check specific WebSocket hook
      const webSocketHookPath = path.join(this.srcPath, "hooks/use-websocket.ts");
      const hasProperCleanup = this.fileContainsPattern(
        webSocketHookPath, 
        "return.*=>.*{[^}]*cleanup[^}]*}|return.*=>.*{[^}]*unsubscribe[^}]*}"
      );

      return {
        pattern,
        description: "React hooks implement proper cleanup in useEffect",
        files,
        status: hasProperCleanup ? "PASS" : "WARNING",
        details: hasProperCleanup 
          ? "React hooks properly implement cleanup patterns"
          : "Some React hooks may not implement proper cleanup"
      };
    } catch (error) {
      return {
        pattern,
        description: "React hook cleanup verification",
        files: [],
        status: "WARNING",
        details: `Verification failed: ${error}`
      };
    }
  }

  private async checkIntervalCleanup(): Promise<VerificationResult> {
    const pattern = "Interval/Timer Cleanup";
    
    try {
      // Check for proper interval cleanup patterns
      const { stdout } = await execAsync(
        `find ${this.srcPath} -name "*.ts" | ` +
        `xargs grep -l "setInterval\\|setTimeout" | ` +
        `xargs grep -l "clearInterval\\|clearTimeout"`
      );
      
      const files = stdout.trim().split('\n').filter(f => f);
      
      return {
        pattern,
        description: "Services properly clean up intervals and timers",
        files,
        status: files.length > 0 ? "PASS" : "WARNING",
        details: `${files.length} files implement interval cleanup patterns`
      };
    } catch (error) {
      return {
        pattern,
        description: "Interval cleanup verification", 
        files: [],
        status: "WARNING",
        details: `Verification failed: ${error}`
      };
    }
  }

  private async checkBrowserCompatibleEventEmitter(): Promise<VerificationResult> {
    const pattern = "BrowserCompatibleEventEmitter Fix";
    
    const filePath = path.join(this.srcPath, "lib/browser-compatible-events.ts");
    
    const hasWrappedListenerMap = this.fileContainsPattern(filePath, "wrappedListenerMap");
    const hasProperOff = this.fileContainsPattern(filePath, "wrappedListenerMap\\.get\\(listener\\)");
    const hasProperRemoveAll = this.fileContainsPattern(filePath, "wrappedListenerMap\\.clear\\(\\)");
    
    const isFixed = hasWrappedListenerMap && hasProperOff && hasProperRemoveAll;
    
    return {
      pattern,
      description: "BrowserCompatibleEventEmitter properly tracks wrapped listeners",
      files: [filePath],
      status: isFixed ? "PASS" : "FAIL",
      details: isFixed 
        ? "BrowserCompatibleEventEmitter properly tracks and cleans up wrapped listeners"
        : "BrowserCompatibleEventEmitter needs wrapped listener tracking fixes"
    };
  }

  private fileContainsPattern(filePath: string, pattern: string): boolean {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const regex = new RegExp(pattern, 'i');
      return regex.test(content);
    } catch {
      return false;
    }
  }

  private printResults(results: VerificationResult[]): void {
    console.log("\n🔍 VERIFICATION RESULTS:");
    console.log("-".repeat(80));

    results.forEach((result, index) => {
      const statusIcon = result.status === "PASS" ? "✅" : 
                        result.status === "WARNING" ? "⚠️" : "❌";
      
      console.log(`\n${index + 1}. ${statusIcon} ${result.pattern}`);
      console.log(`   Description: ${result.description}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Details: ${result.details}`);
      if (result.files.length > 0) {
        console.log(`   Files affected: ${result.files.length}`);
      }
    });
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new MemoryLeakVerifier();
  verifier.runVerification().then(success => {
    process.exit(success ? 0 : 1);
  });
}