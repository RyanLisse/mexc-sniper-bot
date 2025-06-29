#!/usr/bin/env bun
/**
 * Simple test to check if workflow validation warnings are resolved
 */

import { MexcOrchestrator } from './src/mexc-agents/orchestrator';

async function testValidationWarnings() {
  console.log("🔧 Testing Agent Registration Warnings Fix\n");
  
  try {
    const startTime = Date.now();
    
    // Create orchestrator with enhanced coordination
    const orchestrator = new MexcOrchestrator({ 
      useEnhancedCoordination: true,
      coordinationConfig: {
        healthCheckInterval: 30000,
        performanceCollectionInterval: 60000,
        maxHistorySize: 500
      }
    });

    // Wait for initialization (this should register agents first, then validate workflows)
    console.log("Initializing coordination system...");
    const initSuccess = await orchestrator.waitForCoordinationInitialization();
    
    if (initSuccess) {
      console.log("✅ Enhanced coordination initialized successfully");
      console.log(`✅ Initialization completed in ${Date.now() - startTime}ms`);
      
      // Check if enhanced coordination is ready
      const isReady = orchestrator.isEnhancedCoordinationReady();
      console.log(`✅ Enhanced coordination ready: ${isReady}`);
      
      // Try to get agent health to see if agents are accessible
      try {
        const agentHealth = await orchestrator.getAgentHealth();
        console.log("✅ Agent health check completed:", agentHealth);
      } catch (healthError) {
        console.log("🟡 Agent health check failed:", healthError);
      }
      
      console.log("\n🎯 Expected Outcome:");
      console.log("✅ If no workflow validation warnings appear above, the fix was successful");
      console.log("✅ The 10 agent registration warnings should be eliminated");
      console.log("✅ Agents should be registered before workflow validation occurs");
      
    } else {
      console.log("❌ Enhanced coordination initialization failed");
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

if (import.meta.main) {
  testValidationWarnings().catch(console.error);
}