import { useAuth } from "@/src/lib/kinde-auth-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface ApiCredentials {
  id?: number;
  userId: string;
  provider: string;
  apiKey: string;
  secretKey: string;
  passphrase?: string;
  isActive: boolean;
  lastUsed?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  // For testing - remove in production
  _testApiKey?: string;
  _testSecretKey?: string;
}

export interface SaveApiCredentialsRequest {
  userId: string;
  provider?: string;
  apiKey: string;
  secretKey: string;
  passphrase?: string;
}

// Fetch API credentials for a user and provider
export function useApiCredentials(userId: string, provider = "mexc") {
  const { user, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["api-credentials", userId, provider],
    queryFn: async (): Promise<ApiCredentials | null> => {
      const response = await fetch(
        `/api/api-credentials?userId=${encodeURIComponent(userId)}&provider=${encodeURIComponent(provider)}`
      );

      if (!response.ok) {
        // Don't throw errors for 403/401 when not authenticated
        if (!isAuthenticated && (response.status === 403 || response.status === 401)) {
          return null;
        }
        throw new Error("Failed to fetch API credentials");
      }

      return response.json();
    },
    // Only fetch credentials if user is authenticated and it's their own data
    enabled: !!userId && isAuthenticated && user?.id === userId,
  });
}

// Save API credentials
export function useSaveApiCredentials() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  return useMutation({
    mutationFn: async (data: SaveApiCredentialsRequest) => {
      // Check authentication before saving
      if (!isAuthenticated || !user?.id) {
        throw new Error("Authentication required to save credentials");
      }

      // Ensure user can only save their own credentials
      if (user.id !== data.userId) {
        throw new Error("Access denied: You can only save your own credentials");
      }

      // Enhanced debugging for request
      const requestPayload = JSON.stringify(data);
      console.log('[DEBUG] Sending API credentials request:', {
        url: '/api/api-credentials',
        method: 'POST',
        contentType: 'application/json',
        userId: data.userId,
        provider: data.provider || 'mexc',
        hasApiKey: !!data.apiKey,
        hasSecretKey: !!data.secretKey,
        payloadLength: requestPayload.length,
        timestamp: new Date().toISOString()
      });

      const response = await fetch("/api/api-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestPayload,
      });

      console.log('[DEBUG] API credentials response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        let errorDetails;
        try {
          errorDetails = await response.json();
          console.error('[DEBUG] API credentials error response:', errorDetails);
        } catch (parseError) {
          console.error('[DEBUG] Failed to parse error response:', parseError);
          errorDetails = { 
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: 'Failed to parse error response'
          };
        }
        
        throw new Error(errorDetails.error || errorDetails.message || "Failed to save API credentials");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch API credentials
      queryClient.invalidateQueries({
        queryKey: ["api-credentials", variables.userId, variables.provider || "mexc"],
      });
    },
  });
}

// Delete API credentials
export function useDeleteApiCredentials() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, provider = "mexc" }: { userId: string; provider?: string }) => {
      // Check authentication before deleting
      if (!isAuthenticated || !user?.id) {
        throw new Error("Authentication required to delete credentials");
      }

      // Ensure user can only delete their own credentials
      if (user.id !== userId) {
        throw new Error("Access denied: You can only delete your own credentials");
      }

      const response = await fetch(
        `/api/api-credentials?userId=${encodeURIComponent(userId)}&provider=${encodeURIComponent(provider)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete API credentials");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate and refetch API credentials
      queryClient.invalidateQueries({
        queryKey: ["api-credentials", variables.userId, variables.provider],
      });
    },
  });
}

// Test API credentials
export function useTestApiCredentials() {
  const { user, isAuthenticated } = useAuth();

  return useMutation({
    mutationFn: async ({ userId, provider = "mexc" }: { userId: string; provider?: string }) => {
      // Check authentication before testing
      if (!isAuthenticated || !user?.id) {
        throw new Error("Authentication required to test credentials");
      }

      // Ensure user can only test their own credentials
      if (user.id !== userId) {
        throw new Error("Access denied: You can only test your own credentials");
      }

      // This would normally test the API connection
      // For now, just simulate a test
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate random success/failure for testing
      const success = Math.random() > 0.3;

      if (!success) {
        throw new Error("API credentials test failed: Invalid key or network error");
      }

      return {
        success: true,
        message: "API credentials are valid and connection successful",
        accountInfo: {
          accountType: "spot",
          canTrade: true,
          permissions: ["spot", "futures"],
        },
      };
    },
  });
}
