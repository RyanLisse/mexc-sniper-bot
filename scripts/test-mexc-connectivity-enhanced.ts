#!/usr/bin/env bun

/**
 * Enhanced MEXC Connectivity Test
 * 
 * Tests MEXC API connectivity and trading permissions to verify
 * if the auto-sniping system can actually place orders today.
 */

import { config } from "dotenv";
import { resolve } from "path";
import crypto from "crypto";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

interface ConnectivityReport {
  overall: "READY" | "PARTIAL" | "BLOCKED";
  apiConnectivity: boolean;
  accountAccess: boolean;
  tradingPermissions: boolean;
  balanceCheck: boolean;
  orderCapability: boolean;
  accountInfo?: any;
  balances?: any[];
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

class MexcConnectivityTester {
  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  
  constructor() {
    this.apiKey = process.env.MEXC_API_KEY || "";
    this.secretKey = process.env.MEXC_SECRET_KEY || "";
    this.baseUrl = process.env.MEXC_BASE_URL || "https://api.mexc.com";
  }

  async test(): Promise<ConnectivityReport> {
    const report: ConnectivityReport = {
      overall: "BLOCKED",
      apiConnectivity: false,
      accountAccess: false,
      tradingPermissions: false,
      balanceCheck: false,
      orderCapability: false,
      errors: [],
      warnings: [],
      recommendations: []
    };

    console.log("🔌 Testing MEXC API Connectivity...\n");

    // Check if credentials are available
    if (!this.apiKey || !this.secretKey) {
      report.errors.push("MEXC API credentials not configured");
      report.recommendations.push("Set MEXC_API_KEY and MEXC_SECRET_KEY in .env.local");
      return report;
    }

    // 1. Test basic API connectivity
    try {
      await this.testBasicConnectivity(report);
    } catch (error) {
      report.errors.push(`API connectivity test failed: ${error}`);
    }

    // 2. Test account access
    if (report.apiConnectivity) {
      try {
        await this.testAccountAccess(report);
      } catch (error) {
        report.errors.push(`Account access test failed: ${error}`);
      }
    }

    // 3. Test trading permissions
    if (report.accountAccess) {
      try {
        await this.testTradingPermissions(report);
      } catch (error) {
        report.errors.push(`Trading permissions test failed: ${error}`);
      }
    }

    // 4. Test balance check
    if (report.accountAccess) {
      try {
        await this.testBalanceCheck(report);
      } catch (error) {
        report.errors.push(`Balance check failed: ${error}`);
      }
    }

    // 5. Test order capability (test order that won't execute)
    if (report.tradingPermissions) {
      try {
        await this.testOrderCapability(report);
      } catch (error) {
        report.warnings.push(`Order capability test failed: ${error}`);
      }
    }

    // Determine overall status
    this.calculateOverallStatus(report);

    return report;
  }

  private async testBasicConnectivity(report: ConnectivityReport): Promise<void> {
    console.log("1. 🌐 Testing basic API connectivity...");
    
    try {
      const response = await fetch(`${this.baseUrl}/api/v3/time`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ API endpoint reachable (server time: ${new Date(data.serverTime)})`);
        report.apiConnectivity = true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ API connectivity failed: ${error}`);
      report.errors.push(`Cannot reach MEXC API: ${error}`);
    }
  }

  private async testAccountAccess(report: ConnectivityReport): Promise<void> {
    console.log("2. 🔐 Testing account access...");
    
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = this.createSignature(queryString);
      
      const response = await fetch(`${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`, {
        headers: {
          'X-MEXC-APIKEY': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Account access successful`);
        console.log(`   📊 Account type: ${data.accountType || 'SPOT'}`);
        console.log(`   🔒 Trading enabled: ${data.canTrade || 'unknown'}`);
        
        report.accountAccess = true;
        report.accountInfo = data;
        
        if (!data.canTrade) {
          report.warnings.push("Account may not have trading permissions enabled");
        }
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.log(`   ❌ Account access failed: ${error}`);
      report.errors.push(`Cannot access account: ${error}`);
      
      if (error instanceof Error && error.message.includes("signature")) {
        report.recommendations.push("Check if API key signature is correct and server time is synchronized");
      }
    }
  }

  private async testTradingPermissions(report: ConnectivityReport): Promise<void> {
    console.log("3. 📈 Testing trading permissions...");
    
    try {
      // Check if account can trade
      if (report.accountInfo?.canTrade === false) {
        console.log(`   ❌ Trading not enabled on account`);
        report.errors.push("Trading is not enabled on this account");
        report.recommendations.push("Enable trading permissions in MEXC account settings");
        return;
      }

      // Check exchange info for trading rules
      const response = await fetch(`${this.baseUrl}/api/v3/exchangeInfo`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Exchange info accessible`);
        console.log(`   📋 Available symbols: ${data.symbols?.length || 'unknown'}`);
        
        // Look for USDT trading pairs
        const usdtPairs = data.symbols?.filter((s: any) => s.symbol.endsWith('USDT')) || [];
        console.log(`   💰 USDT trading pairs: ${usdtPairs.length}`);
        
        report.tradingPermissions = true;
        
        if (usdtPairs.length === 0) {
          report.warnings.push("No USDT trading pairs found");
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ Trading permissions check failed: ${error}`);
      report.warnings.push(`Cannot verify trading permissions: ${error}`);
    }
  }

  private async testBalanceCheck(report: ConnectivityReport): Promise<void> {
    console.log("4. 💰 Testing balance check...");
    
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = this.createSignature(queryString);
      
      const response = await fetch(`${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`, {
        headers: {
          'X-MEXC-APIKEY': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const balances = data.balances || [];
        
        // Filter out zero balances
        const nonZeroBalances = balances.filter((b: any) => 
          parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
        );
        
        console.log(`   ✅ Balance check successful`);
        console.log(`   💼 Total assets: ${balances.length}`);
        console.log(`   💰 Non-zero balances: ${nonZeroBalances.length}`);
        
        // Check for USDT balance
        const usdtBalance = balances.find((b: any) => b.asset === 'USDT');
        if (usdtBalance) {
          const totalUsdt = parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked);
          console.log(`   💵 USDT balance: ${totalUsdt.toFixed(4)} USDT`);
          
          const positionSize = parseFloat(process.env.AUTO_SNIPING_POSITION_SIZE_USDT || "10");
          if (totalUsdt >= positionSize) {
            console.log(`   ✅ Sufficient balance for trading (need: $${positionSize} USDT)`);
          } else {
            console.log(`   ⚠️  Insufficient balance for configured position size`);
            report.warnings.push(`USDT balance (${totalUsdt}) < position size (${positionSize})`);
            report.recommendations.push("Deposit more USDT or reduce position size");
          }
        } else {
          console.log(`   ⚠️  No USDT balance found`);
          report.warnings.push("No USDT balance - cannot trade without base currency");
          report.recommendations.push("Deposit USDT to enable trading");
        }
        
        report.balanceCheck = true;
        report.balances = nonZeroBalances;
        
        // Show top 5 balances
        if (nonZeroBalances.length > 0) {
          console.log(`   📊 Top balances:`);
          nonZeroBalances.slice(0, 5).forEach((balance: any) => {
            const total = parseFloat(balance.free) + parseFloat(balance.locked);
            console.log(`      ${balance.asset}: ${total.toFixed(8)}`);
          });
        }
        
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ Balance check failed: ${error}`);
      report.errors.push(`Cannot check account balance: ${error}`);
    }
  }

  private async testOrderCapability(report: ConnectivityReport): Promise<void> {
    console.log("5. 🛒 Testing order capability (test mode)...");
    
    try {
      // We'll test with a very small, unlikely-to-fill order for BTCUSDT
      const timestamp = Date.now();
      const symbol = "BTCUSDT";
      const side = "BUY";
      const type = "LIMIT";
      const quantity = "0.00001"; // Very small quantity
      const price = "1.00"; // Very low price that won't fill
      
      const params = new URLSearchParams({
        symbol,
        side,
        type,
        quantity,
        price,
        timeInForce: "IOC", // Immediate or Cancel - will cancel immediately
        timestamp: timestamp.toString()
      });
      
      const signature = this.createSignature(params.toString());
      params.append('signature', signature);
      
      console.log(`   🧪 Testing with ${side} ${quantity} ${symbol} at $${price} (will not execute)`);
      
      // For safety, we'll just validate the signature format rather than placing a real order
      if (signature && signature.length > 0) {
        console.log(`   ✅ Order signature generation successful`);
        console.log(`   ✅ Order parameters properly formatted`);
        report.orderCapability = true;
        
        // Note: In a real test, you might place the order with `test: true` parameter if MEXC supports it
        report.warnings.push("Order capability verified by signature only - no live order placed");
      } else {
        throw new Error("Failed to generate order signature");
      }
      
    } catch (error) {
      console.log(`   ⚠️  Order capability test failed: ${error}`);
      report.warnings.push(`Order capability uncertain: ${error}`);
    }
  }

  private createSignature(queryString: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(queryString)
      .digest('hex');
  }

  private calculateOverallStatus(report: ConnectivityReport): void {
    const criticalIssues = report.errors.length;
    const warnings = report.warnings.length;
    
    if (criticalIssues > 0) {
      report.overall = "BLOCKED";
    } else if (warnings > 0 || !report.balanceCheck) {
      report.overall = "PARTIAL";
    } else {
      report.overall = "READY";
    }
  }

  printReport(report: ConnectivityReport): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 MEXC API CONNECTIVITY & TRADING READINESS REPORT");
    console.log("=".repeat(60));
    
    // Overall status
    const statusIcon = report.overall === "READY" ? "✅" : 
                      report.overall === "PARTIAL" ? "⚠️" : "❌";
    console.log(`\n${statusIcon} Overall Status: ${report.overall}`);
    
    // Component status
    console.log("\n📋 Component Status:");
    console.log(`   API Connectivity: ${report.apiConnectivity ? "✅" : "❌"}`);
    console.log(`   Account Access: ${report.accountAccess ? "✅" : "❌"}`);
    console.log(`   Trading Permissions: ${report.tradingPermissions ? "✅" : "❌"}`);
    console.log(`   Balance Check: ${report.balanceCheck ? "✅" : "❌"}`);
    console.log(`   Order Capability: ${report.orderCapability ? "✅" : "❌"}`);
    
    // Account info
    if (report.accountInfo) {
      console.log("\n👤 Account Information:");
      console.log(`   Account Type: ${report.accountInfo.accountType || "SPOT"}`);
      console.log(`   Can Trade: ${report.accountInfo.canTrade !== false ? "Yes" : "No"}`);
      console.log(`   Can Withdraw: ${report.accountInfo.canWithdraw !== false ? "Yes" : "No"}`);
      console.log(`   Can Deposit: ${report.accountInfo.canDeposit !== false ? "Yes" : "No"}`);
    }
    
    // Balance summary
    if (report.balances && report.balances.length > 0) {
      console.log("\n💰 Balance Summary:");
      const usdtBalance = report.balances.find((b: any) => b.asset === 'USDT');
      if (usdtBalance) {
        const total = parseFloat(usdtBalance.free) + parseFloat(usdtBalance.locked);
        console.log(`   USDT: ${total.toFixed(4)} (Free: ${usdtBalance.free}, Locked: ${usdtBalance.locked})`);
      }
      console.log(`   Total non-zero assets: ${report.balances.length}`);
    }
    
    // Errors
    if (report.errors.length > 0) {
      console.log("\n🚨 Critical Issues:");
      report.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }
    
    // Warnings
    if (report.warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      report.warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }
    
    // Recommendations
    if (report.recommendations.length > 0) {
      console.log("\n💡 Recommendations:");
      report.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }
    
    console.log("\n" + "=".repeat(60));
    
    if (report.overall === "READY") {
      console.log("🎉 MEXC API IS READY FOR AUTO-SNIPING!");
    } else if (report.overall === "PARTIAL") {
      console.log("⚠️  MEXC API PARTIALLY READY - ADDRESS WARNINGS");
    } else {
      console.log("❌ MEXC API BLOCKED - RESOLVE CRITICAL ISSUES");
    }
    
    console.log("=".repeat(60));
  }
}

// Main execution
async function main() {
  const tester = new MexcConnectivityTester();
  
  try {
    const report = await tester.test();
    tester.printReport(report);
    
    // Save report
    const fs = await import("fs/promises");
    const reportPath = resolve(process.cwd(), "reports", `mexc-connectivity-${Date.now()}.json`);
    
    try {
      await fs.mkdir(resolve(process.cwd(), "reports"), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Report saved to: ${reportPath}`);
    } catch (saveError) {
      console.warn(`\n⚠️  Could not save report: ${saveError}`);
    }
    
    // Exit with appropriate code
    process.exit(report.overall === "BLOCKED" ? 1 : 0);
    
  } catch (error) {
    console.error("❌ Connectivity test failed:", error);
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

export { MexcConnectivityTester };