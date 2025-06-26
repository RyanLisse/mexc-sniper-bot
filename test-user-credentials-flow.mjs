#!/usr/bin/env node
/**
 * Test script to verify user-specific credential flow works correctly
 * 
 * This tests:
 * 1. Saving user credentials through API
 * 2. Retrieving balance using user-specific credentials  
 * 3. Verifying fallback to environment credentials
 */

const testUserId = "test-user-123";
const baseUrl = process.env.TEST_URL || "http://localhost:3000";

async function testUserCredentialFlow() {
  console.log("🧪 Testing User Credential Flow...\n");

  try {
    // Test 1: Save user credentials
    console.log("1. Testing credential save...");
    const saveResponse = await fetch(`${baseUrl}/api/api-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        provider: 'mexc',
        apiKey: 'test_api_key_12345',
        secretKey: 'test_secret_key_67890abcdef'
      })
    });

    if (saveResponse.ok) {
      console.log("✅ Credentials saved successfully");
    } else {
      const error = await saveResponse.text();
      console.log("❌ Failed to save credentials:", error);
    }

    // Test 2: Retrieve balance with user credentials
    console.log("\n2. Testing balance retrieval with user credentials...");
    const balanceResponse = await fetch(`${baseUrl}/api/account/balance?userId=${testUserId}`);
    
    if (balanceResponse.ok) {
      const balanceData = await balanceResponse.json();
      console.log("✅ Balance API responded successfully");
      console.log("📊 Response data:", {
        success: balanceData.success,
        hasData: !!balanceData.data,
        credentialSource: balanceData.data?.credentialSource || 'unknown'
      });
    } else {
      const error = await balanceResponse.text();
      console.log("❌ Balance API failed:", error);
    }

    // Test 3: Test fallback to environment credentials
    console.log("\n3. Testing fallback to environment credentials...");
    const fallbackResponse = await fetch(`${baseUrl}/api/account/balance?userId=non-existent-user`);
    
    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      console.log("✅ Fallback to environment credentials works");
      console.log("📊 Fallback response:", {
        success: fallbackData.success,
        hasData: !!fallbackData.data
      });
    } else {
      console.log("❌ Fallback failed - this is expected if no environment credentials");
    }

  } catch (error) {
    console.error("❌ Test failed with error:", error.message);
  }

  console.log("\n🏁 User credential flow test completed!");
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testUserCredentialFlow();
}

export { testUserCredentialFlow };