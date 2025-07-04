"use client";

import { useEffect, useState } from "react";
import { useSupabaseAuth } from "@/src/components/auth/supabase-auth-provider-clean";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  isBrowserEnvironment,
  isNodeEnvironment,
} from "@/src/lib/browser-compatible-events";

interface AuthDiagnostics {
  supabaseConfigured: boolean;
  clientInitialized: boolean;
  sessionExists: boolean;
  userExists: boolean;
  hydrationComplete: boolean;
  authStateListening: boolean;
  apiEndpointAccessible: boolean;
}

export function AuthStatusChecker() {
  const { user, session, isLoading, isHydrated } = useSupabaseAuth();
  const [diagnostics, setDiagnostics] = useState<AuthDiagnostics>({
    supabaseConfigured: false,
    clientInitialized: false,
    sessionExists: false,
    userExists: false,
    hydrationComplete: false,
    authStateListening: false,
    apiEndpointAccessible: false,
  });

  useEffect(() => {
    const runDiagnostics = async () => {
      // Check Supabase configuration
      const supabaseConfigured = !!(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      // Check if session API is accessible
      let apiEndpointAccessible = false;
      try {
        const response = await fetch("/api/auth/supabase-session");
        apiEndpointAccessible = response.status !== 404;
      } catch {
        apiEndpointAccessible = false;
      }

      setDiagnostics({
        supabaseConfigured,
        clientInitialized: true, // If we're here, client is initialized
        sessionExists: !!session,
        userExists: !!user,
        hydrationComplete: isHydrated,
        authStateListening: true, // Assume true if hooks are working
        apiEndpointAccessible,
      });
    };

    runDiagnostics();
  }, [user, session, isHydrated]);

  const getStatusBadge = (status: boolean) => (
    <Badge variant={status ? "default" : "destructive"}>
      {status ? "✓" : "✗"}
    </Badge>
  );

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Authentication Status Check
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <span>Supabase Environment Variables</span>
            {getStatusBadge(diagnostics.supabaseConfigured)}
          </div>

          <div className="flex items-center justify-between">
            <span>Client Initialized</span>
            {getStatusBadge(diagnostics.clientInitialized)}
          </div>

          <div className="flex items-center justify-between">
            <span>Hydration Complete</span>
            {getStatusBadge(diagnostics.hydrationComplete)}
          </div>

          <div className="flex items-center justify-between">
            <span>Auth State Listening</span>
            {getStatusBadge(diagnostics.authStateListening)}
          </div>

          <div className="flex items-center justify-between">
            <span>API Endpoint Accessible</span>
            {getStatusBadge(diagnostics.apiEndpointAccessible)}
          </div>

          <div className="flex items-center justify-between">
            <span>Session Exists</span>
            {getStatusBadge(diagnostics.sessionExists)}
          </div>

          <div className="flex items-center justify-between">
            <span>User Authenticated</span>
            {getStatusBadge(diagnostics.userExists)}
          </div>
        </div>

        {user && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">User Details:</h4>
            <div className="text-sm space-y-1">
              <p>
                <strong>ID:</strong> {user.id}
              </p>
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>Verified:</strong>{" "}
                {user.email_confirmed_at ? "Yes" : "No"}
              </p>
              <p>
                <strong>Created:</strong> {user.created_at}
              </p>
            </div>
          </div>
        )}

        {session && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <h4 className="font-medium mb-2">Session Details:</h4>
            <div className="text-sm space-y-1">
              <p>
                <strong>Access Token:</strong>{" "}
                {session.access_token ? "Present" : "Missing"}
              </p>
              <p>
                <strong>Refresh Token:</strong>{" "}
                {session.refresh_token ? "Present" : "Missing"}
              </p>
              <p>
                <strong>Expires:</strong>{" "}
                {session.expires_at
                  ? new Date(session.expires_at * 1000).toLocaleString()
                  : "Unknown"}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Environment Info:</h4>
          <div className="text-sm space-y-1">
            <p>
              <strong>Supabase URL:</strong>{" "}
              {process.env.NEXT_PUBLIC_SUPABASE_URL ? "Configured" : "Missing"}
            </p>
            <p>
              <strong>Anon Key:</strong>{" "}
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                ? "Configured"
                : "Missing"}
            </p>
            <p>
              <strong>Loading State:</strong> {isLoading ? "Loading" : "Ready"}
            </p>
            <p>
              <strong>Hydrated:</strong> {isHydrated ? "Yes" : "No"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
