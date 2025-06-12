"use client";

import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { useState } from "react";

export function AuthDebug() {
  const [results, setResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testEndpoint = async (path: string, method: string = "GET", body?: any) => {
    try {
      addResult(`Testing ${method} ${path}...`);
      
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      };

      if (body && method !== "GET") {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(path, options);
      const responseText = await response.text();
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      addResult(`${method} ${path}: ${response.status} ${response.statusText}`);
      addResult(`Response: ${JSON.stringify(responseData, null, 2)}`);
      
      return response;
    } catch (error) {
      addResult(`${method} ${path}: ERROR - ${error}`);
      return null;
    }
  };

  const runAuthTests = async () => {
    setResults([]);
    
    // Test GET session
    await testEndpoint("/api/auth/get-session", "GET");
    
    // Test sign-in endpoint with different methods
    const testEmail = "test@example.com";
    const testPassword = "password123";
    
    // Test POST sign-in (correct method)
    await testEndpoint("/api/auth/sign-in/email", "POST", {
      email: testEmail,
      password: testPassword,
    });
    
    // Test what happens with GET (to reproduce 405)
    await testEndpoint("/api/auth/sign-in/email", "GET");
    
    // Test sign-up endpoint
    await testEndpoint("/api/auth/sign-up/email", "POST", {
      email: testEmail,
      password: testPassword,
    });
    
    // Test base auth endpoint
    await testEndpoint("/api/auth", "GET");
    await testEndpoint("/api/auth/", "GET");
  };

  const testBetterAuthClient = async () => {
    setResults([]);
    addResult("Testing better-auth client methods...");
    
    try {
      const { authClient } = await import("@/src/lib/auth-client");
      
      // Test session fetch
      addResult("Calling authClient.getSession()...");
      const session = await authClient.getSession();
      addResult(`Session result: ${JSON.stringify(session, null, 2)}`);
      
      // Log the actual fetch URL being used
      addResult(`Auth client base URL: ${authClient.baseURL || 'not set'}`);
      
    } catch (error) {
      addResult(`Client test error: ${error}`);
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Auth Debug Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runAuthTests}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Test Auth Endpoints
          </Button>
          <Button 
            onClick={testBetterAuthClient}
            className="bg-green-600 hover:bg-green-700"
          >
            Test Auth Client
          </Button>
          <Button 
            onClick={() => setResults([])}
            variant="outline"
            className="border-slate-600"
          >
            Clear
          </Button>
        </div>
        
        <div className="bg-slate-900 rounded p-4 max-h-96 overflow-y-auto">
          <pre className="text-xs text-slate-300 whitespace-pre-wrap">
            {results.length === 0 ? "Click a button to run tests..." : results.join("\n")}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}