"use client";

/**
 * Test Credentials Component with Status Synchronization
 *
 * Demonstrates how to properly handle status synchronization when testing
 * API credentials, ensuring UI state remains consistent across all components.
 */

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { extractStatusSyncData, useStatusSync } from "@/hooks/use-status-sync";

// ============================================================================
// Types & Interfaces
// ============================================================================

interface TestCredentialsRequest {
  userId: string;
  provider: "mexc";
}

interface TestCredentialsResponse {
  success: boolean;
  data?: {
    connectivity: boolean;
    authentication: boolean;
    accountType: string;
    canTrade: boolean;
    balanceCount: number;
    statusSync: {
      cacheInvalidated: boolean;
      timestamp: string;
      triggeredBy: string;
      success?: boolean;
      servicesNotified?: string[];
      statusRefreshed?: boolean;
    };
  };
  error?: string;
  code?: string;
}

// ============================================================================
// Component Implementation
// ============================================================================

export function TestCredentialsWithSync() {
  const supabase = createClientComponentClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase]);
  const _queryClient = useQueryClient();
  const { handleStatusSync, invalidateStatusQueries, getCacheStatus } =
    useStatusSync();
  const [showSyncDetails, setShowSyncDetails] = useState(false);

  // Test credentials mutation with status sync handling
  const testCredentialsMutation = useMutation({
    mutationFn: async (
      request: TestCredentialsRequest
    ): Promise<TestCredentialsResponse> => {
      const response = await fetch("/api/api-credentials/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Credential test failed");
      }

      return response.json();
    },
    onSuccess: async (data) => {
      console.info("[TestCredentials] Test completed successfully", data);

      // Extract and handle status sync data
      const statusSyncData = extractStatusSyncData(data);
      if (statusSyncData) {
        console.info(
          "[TestCredentials] Processing status sync data",
          statusSyncData
        );

        await handleStatusSync(statusSyncData, {
          invalidateRelatedQueries: true,
          refetchActiveQueries: true,
          notifySuccess: true,
        });
      } else {
        console.warn(
          "[TestCredentials] No status sync data received - manual cache invalidation"
        );
        await invalidateStatusQueries();
      }
    },
    onError: (error) => {
      console.error("[TestCredentials] Test failed:", error);
    },
  });

  // Handle test credentials button click
  const handleTestCredentials = () => {
    if (!user?.id) {
      console.error("[TestCredentials] No user ID available");
      return;
    }

    testCredentialsMutation.mutate({
      userId: user.id,
      provider: "mexc",
    });
  };

  // Handle manual cache invalidation
  const handleManualInvalidation = async () => {
    console.info("[TestCredentials] Manually invalidating status queries");
    await invalidateStatusQueries();
  };

  // Get current sync status from the response
  const syncData = testCredentialsMutation.data?.data?.statusSync;
  const isLoading = testCredentialsMutation.isPending;
  const error = testCredentialsMutation.error;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Test API Credentials
        </CardTitle>
        <CardDescription>
          Test your MEXC API credentials and verify status synchronization
          across all systems
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Test Button */}
        <div className="flex gap-2">
          <Button
            onClick={handleTestCredentials}
            disabled={isLoading || !user?.id}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {isLoading ? "Testing Credentials..." : "Test Credentials"}
          </Button>

          <Button
            variant="outline"
            onClick={handleManualInvalidation}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Status
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>Test failed: {error.message}</AlertDescription>
          </Alert>
        )}

        {/* Success Display */}
        {testCredentialsMutation.isSuccess &&
          testCredentialsMutation.data?.success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Credentials test completed successfully! Status has been
                synchronized across all systems.
              </AlertDescription>
            </Alert>
          )}

        {/* Test Results */}
        {testCredentialsMutation.data?.data && (
          <div className="space-y-3">
            <h4 className="font-medium">Test Results</h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">Connectivity</span>
                <Badge
                  variant={
                    testCredentialsMutation.data.data.connectivity
                      ? "default"
                      : "destructive"
                  }
                >
                  {testCredentialsMutation.data.data.connectivity
                    ? "Connected"
                    : "Failed"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">Authentication</span>
                <Badge
                  variant={
                    testCredentialsMutation.data.data.authentication
                      ? "default"
                      : "destructive"
                  }
                >
                  {testCredentialsMutation.data.data.authentication
                    ? "Valid"
                    : "Invalid"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">Account Type</span>
                <Badge variant="outline">
                  {testCredentialsMutation.data.data.accountType.toUpperCase()}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">Can Trade</span>
                <Badge
                  variant={
                    testCredentialsMutation.data.data.canTrade
                      ? "default"
                      : "secondary"
                  }
                >
                  {testCredentialsMutation.data.data.canTrade ? "Yes" : "No"}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Status Sync Information */}
        {syncData && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Status Synchronization</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSyncDetails(!showSyncDetails)}
              >
                {showSyncDetails ? "Hide Details" : "Show Details"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">Cache Invalidated</span>
                <Badge
                  variant={
                    syncData.cacheInvalidated ? "default" : "destructive"
                  }
                >
                  {syncData.cacheInvalidated ? "Yes" : "No"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">Status Refreshed</span>
                <Badge
                  variant={syncData.statusRefreshed ? "default" : "secondary"}
                >
                  {syncData.statusRefreshed ? "Yes" : "No"}
                </Badge>
              </div>
            </div>

            {showSyncDetails && (
              <div className="p-3 bg-gray-50 rounded border">
                <h5 className="font-medium text-sm mb-2">Sync Details</h5>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-medium">Triggered By:</span>{" "}
                    {syncData.triggeredBy}
                  </div>
                  <div>
                    <span className="font-medium">Timestamp:</span>{" "}
                    {new Date(syncData.timestamp).toLocaleString()}
                  </div>
                  {syncData.servicesNotified && (
                    <div>
                      <span className="font-medium">Services Notified:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {syncData.servicesNotified.map((service) => (
                          <Badge
                            key={service}
                            variant="outline"
                            className="text-xs"
                          >
                            {service}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Development Info */}
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer font-medium">
            Development Info
          </summary>
          <div className="mt-2 p-2 bg-gray-50 rounded">
            <p>
              This component demonstrates proper status synchronization after
              credential testing. When credentials are tested successfully, the
              system:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Invalidates relevant React Query caches</li>
              <li>Refreshes global status services</li>
              <li>Updates the unified status resolver</li>
              <li>Ensures UI consistency across components</li>
            </ul>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
