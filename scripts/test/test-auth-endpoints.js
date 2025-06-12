#!/usr/bin/env node

const BASE_URL = "http://localhost:3008";

async function testEndpoint(path, method = "GET", body = null) {
  console.log(`\n📡 Testing ${method} ${path}`);
  
  try {
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, options);
    const text = await response.text();
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Headers:`, Object.fromEntries(response.headers.entries()));
    
    try {
      const json = JSON.parse(text);
      console.log(`   Response:`, JSON.stringify(json, null, 2));
    } catch {
      console.log(`   Response (text):`, text.substring(0, 200));
    }
    
    return response;
  } catch (error) {
    console.log(`   ❌ Error:`, error.message);
    return null;
  }
}

async function runTests() {
  console.log("🧪 Testing Auth Endpoints");
  console.log("=".repeat(50));

  // Test the base auth endpoint
  await testEndpoint("/api/auth");
  await testEndpoint("/api/auth/");
  
  // Test session endpoint
  await testEndpoint("/api/auth/get-session");
  
  // Test sign-in with GET (should fail with 405)
  await testEndpoint("/api/auth/sign-in/email", "GET");
  
  // Test sign-in with POST (correct method)
  await testEndpoint("/api/auth/sign-in/email", "POST", {
    email: "test@example.com",
    password: "password123"
  });
  
  // Test sign-up
  await testEndpoint("/api/auth/sign-up/email", "POST", {
    email: "newuser@example.com",
    password: "password123"
  });
  
  // Test OPTIONS (CORS preflight)
  await testEndpoint("/api/auth/sign-in/email", "OPTIONS");
}

// Check if server is running
fetch(BASE_URL)
  .then(() => {
    console.log(`✅ Server is running at ${BASE_URL}`);
    runTests();
  })
  .catch(() => {
    console.log(`❌ Server is not running at ${BASE_URL}`);
    console.log("Please start the server with: npm run dev");
  });