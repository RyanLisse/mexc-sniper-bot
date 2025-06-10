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
  return useQuery({
    queryKey: ["api-credentials", userId, provider],
    queryFn: async (): Promise<ApiCredentials | null> => {
      const response = await fetch(
        `/api/api-credentials?userId=${encodeURIComponent(userId)}&provider=${encodeURIComponent(provider)}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch API credentials");
      }

      return response.json();
    },
    enabled: !!userId,
  });
}

// Save API credentials
export function useSaveApiCredentials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SaveApiCredentialsRequest) => {
      const response = await fetch("/api/api-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save API credentials");
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

  return useMutation({
    mutationFn: async ({ userId, provider = "mexc" }: { userId: string; provider?: string }) => {
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
  return useMutation({
    mutationFn: async ({ provider: _provider = "mexc" }: { userId: string; provider?: string }) => {
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
