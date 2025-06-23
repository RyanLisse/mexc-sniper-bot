"use client";

import {
  AlertCircle,
  CheckCircle,
  Database,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Settings,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { useStatus } from "../contexts/status-context-v2";
import {
  type ApiCredentials,
  useApiCredentials,
  useDeleteApiCredentials,
  useSaveApiCredentials,
  useTestApiCredentials,
} from "../hooks/use-api-credentials";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

interface ApiCredentialsFormProps {
  userId: string;
}

export function ApiCredentialsForm({ userId }: ApiCredentialsFormProps) {
  const { data: apiCredentials, isLoading: apiCredsLoading } = useApiCredentials(userId);
  const saveApiCredentials = useSaveApiCredentials();
  const deleteApiCredentials = useDeleteApiCredentials();
  const testApiCredentials = useTestApiCredentials();

  const [editingApiKeys, setEditingApiKeys] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [secretKeyInput, setSecretKeyInput] = useState("");
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    details?: string;
  } | null>(null);

  const handleSaveApiKeys = async () => {
    if (!apiKeyInput.trim() || !secretKeyInput.trim()) {
      setTestResult({ success: false, message: "Please enter both API key and secret key" });
      return;
    }

    // Additional validation for undefined/null values
    if (apiKeyInput === "undefined" || secretKeyInput === "undefined") {
      setTestResult({
        success: false,
        message: "Invalid API credentials - please re-enter your keys",
      });
      return;
    }

    try {
      // Clear any previous test results
      setTestResult(null);

      console.log("[DEBUG] Client-side save request:", {
        userId,
        hasApiKey: !!apiKeyInput.trim(),
        hasSecretKey: !!secretKeyInput.trim(),
        apiKeyLength: apiKeyInput.trim().length,
        secretKeyLength: secretKeyInput.trim().length,
      });

      const result = await saveApiCredentials.mutateAsync({
        userId,
        apiKey: apiKeyInput.trim(),
        secretKey: secretKeyInput.trim(),
        provider: "mexc",
      });

      setEditingApiKeys(false);
      setApiKeyInput("");
      setSecretKeyInput("");

      console.log("[DEBUG] Save result:", result);

      // Show success message with masked credentials for verification
      setTestResult({
        success: true,
        message: `API credentials saved successfully! API Key: ${result.maskedApiKey || "masked"}, Secret: ${result.maskedSecretKey || "masked"}`,
      });

      // Auto-clear success message after 5 seconds
      setTimeout(() => setTestResult(null), 5000);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to save API credentials",
      });
    }
  };

  const handleDeleteApiKeys = async () => {
    try {
      await deleteApiCredentials.mutateAsync({ userId, provider: "mexc" });
      setTestResult({ success: true, message: "API credentials deleted successfully!" });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete API credentials",
      });
    }
  };

  const handleTestApiKeys = async () => {
    try {
      // Clear any previous test results
      setTestResult(null);

      const result = await testApiCredentials.mutateAsync({ userId, provider: "mexc" });

      setTestResult({
        success: true,
        message: result.message,
        details: result.accountType
          ? `Account Type: ${result.accountType}, Can Trade: ${result.canTrade ? "Yes" : "No"}, Assets: ${result.totalAssets || 0}, Balance Count: ${result.balanceCount || 0}${result.hasNonZeroBalances ? ', Has Funds' : ', Empty Balances'}`
          : undefined,
      });

      // Auto-clear success message after 10 seconds
      setTimeout(() => setTestResult(null), 10000);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "API test failed",
      });

      // Auto-clear error message after 15 seconds
      setTimeout(() => setTestResult(null), 15000);
    }
  };

  const handleCancelApiEdit = () => {
    setApiKeyInput("");
    setSecretKeyInput("");
    setEditingApiKeys(false);
    setTestResult(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Key className="h-5 w-5" />
          <span>MEXC API Configuration</span>
        </CardTitle>
        <CardDescription>
          Securely store your MEXC API credentials for automated trading. Your keys are encrypted
          and stored locally.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {apiCredsLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        ) : (
          <>
            {/* Current API Status */}
            <ApiCredentialsStatus apiCredentials={apiCredentials ?? null} />

            {/* Enhanced Credential Source Information */}
            <CredentialSourceAlert />

            {/* API Key Management Form */}
            {editingApiKeys ? (
              <ApiCredentialsEditForm
                apiKeyInput={apiKeyInput}
                secretKeyInput={secretKeyInput}
                showApiKey={showApiKey}
                showSecretKey={showSecretKey}
                onApiKeyChange={setApiKeyInput}
                onSecretKeyChange={setSecretKeyInput}
                onToggleApiKey={() => setShowApiKey(!showApiKey)}
                onToggleSecretKey={() => setShowSecretKey(!showSecretKey)}
                onSave={handleSaveApiKeys}
                onCancel={handleCancelApiEdit}
                isLoading={saveApiCredentials.isPending}
              />
            ) : (
              <ApiCredentialsDisplay
                apiCredentials={apiCredentials ?? null}
                onEdit={() => setEditingApiKeys(true)}
                onTest={handleTestApiKeys}
                onDelete={handleDeleteApiKeys}
                isTestLoading={testApiCredentials.isPending}
                isDeleteLoading={deleteApiCredentials.isPending}
              />
            )}

            {/* Test Result */}
            {testResult && <ApiCredentialsTestResult testResult={testResult} />}

            {/* Security Notice */}
            <SecurityNotice />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ApiCredentialsStatus({ apiCredentials }: { apiCredentials: ApiCredentials | null }) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center space-x-3">
        <Shield className={`h-5 w-5 ${apiCredentials ? "text-green-500" : "text-gray-400"}`} />
        <div>
          <div className="font-medium">
            {apiCredentials ? "API Keys Configured" : "No API Keys"}
          </div>
          <div className="text-sm text-muted-foreground">
            {apiCredentials
              ? `Last updated: ${
                  apiCredentials.updatedAt
                    ? new Date(apiCredentials.updatedAt).toLocaleDateString()
                    : "Unknown"
                }`
              : "Configure your MEXC API keys to enable automated trading"}
          </div>
        </div>
      </div>
      {apiCredentials && (
        <Badge variant={apiCredentials.isActive ? "default" : "secondary"}>
          {apiCredentials.isActive ? "Active" : "Inactive"}
        </Badge>
      )}
    </div>
  );
}

interface ApiCredentialsEditFormProps {
  apiKeyInput: string;
  secretKeyInput: string;
  showApiKey: boolean;
  showSecretKey: boolean;
  onApiKeyChange: (value: string) => void;
  onSecretKeyChange: (value: string) => void;
  onToggleApiKey: () => void;
  onToggleSecretKey: () => void;
  onSave: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ApiCredentialsEditForm({
  apiKeyInput,
  secretKeyInput,
  showApiKey,
  showSecretKey,
  onApiKeyChange,
  onSecretKeyChange,
  onToggleApiKey,
  onToggleSecretKey,
  onSave,
  onCancel,
  isLoading,
}: ApiCredentialsEditFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="mexc-api-key" className="text-sm font-medium">
          MEXC API Key
        </label>
        <div className="relative">
          <Input
            id="mexc-api-key"
            type={showApiKey ? "text" : "password"}
            value={apiKeyInput}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Enter your MEXC API key"
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={onToggleApiKey}
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="mexc-secret-key" className="text-sm font-medium">
          MEXC Secret Key
        </label>
        <div className="relative">
          <Input
            id="mexc-secret-key"
            type={showSecretKey ? "text" : "password"}
            value={secretKeyInput}
            onChange={(e) => onSecretKeyChange(e.target.value)}
            placeholder="Enter your MEXC secret key"
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3"
            onClick={onToggleSecretKey}
          >
            {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          onClick={onSave}
          disabled={isLoading || !apiKeyInput.trim() || !secretKeyInput.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save API Keys"
          )}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface ApiCredentialsDisplayProps {
  apiCredentials: ApiCredentials | null;
  onEdit: () => void;
  onTest: () => void;
  onDelete: () => void;
  isTestLoading: boolean;
  isDeleteLoading: boolean;
}

function ApiCredentialsDisplay({
  apiCredentials,
  onEdit,
  onTest,
  onDelete,
  isTestLoading,
  isDeleteLoading,
}: ApiCredentialsDisplayProps) {
  return (
    <div className="space-y-4">
      {/* Display current keys (masked) */}
      {apiCredentials && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-muted-foreground">API Key</span>
            <div className="font-mono text-sm p-2 bg-muted rounded">{apiCredentials.apiKey}</div>
          </div>
          <div>
            <span className="text-sm font-medium text-muted-foreground">Secret Key</span>
            <div className="font-mono text-sm p-2 bg-muted rounded">{apiCredentials.secretKey}</div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center space-x-2">
        <Button onClick={onEdit} variant={apiCredentials ? "outline" : "default"}>
          {apiCredentials ? "Update API Keys" : "Add API Keys"}
        </Button>

        {apiCredentials && (
          <>
            <Button onClick={onTest} disabled={isTestLoading} variant="outline">
              {isTestLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>

            <Button onClick={onDelete} disabled={isDeleteLoading} variant="destructive">
              {isDeleteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ApiCredentialsTestResult({
  testResult,
}: {
  testResult: { success?: boolean; message?: string; details?: string };
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        testResult.success
          ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-300 dark:border-green-800"
          : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800"
      }`}
    >
      <div className="flex items-center space-x-2">
        {testResult.success ? (
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
        ) : (
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
        )}
        <div className="flex-1">
          <div className="text-sm font-medium">{testResult.message}</div>
          {testResult.details && (
            <div className="text-xs mt-1 opacity-80">{testResult.details}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CredentialSourceAlert() {
  const { status, isLoading } = useStatus();

  if (isLoading) {
    return null;
  }

  const getSourceConfig = () => {
    switch (status.credentials.source) {
      case "database":
        return {
          icon: Database,
          title: "Using Your Saved Credentials",
          description: "API credentials are loaded from your secure user profile settings",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
        };
      case "environment":
        return {
          icon: Settings,
          title: "Using Environment Credentials",
          description:
            "API credentials are loaded from server environment variables (MEXC_API_KEY, MEXC_SECRET_KEY)",
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        };
      default:
        return {
          icon: AlertCircle,
          title: "No Credentials Configured",
          description: "Please add your MEXC API credentials below to enable trading features",
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
        };
    }
  };

  const config = getSourceConfig();
  const Icon = config.icon;

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4`}>
      <div className="flex items-start space-x-2">
        <Icon className={`h-5 w-5 ${config.color} mt-0.5`} />
        <div className={`text-sm ${config.color}`}>
          <div className="font-medium">{config.title}</div>
          <div className="mt-1 text-sm opacity-80">{config.description}</div>
          {status.credentials.hasCredentials && (
            <div className="mt-2 text-xs opacity-70">
              Last checked: {new Date(status.credentials.lastValidated).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SecurityNotice() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-start space-x-2">
        <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
        <div className="text-sm text-blue-700">
          <div className="font-medium">Security Notice</div>
          <div className="mt-1">
            Your API keys are encrypted before storage and never transmitted in plaintext. Make sure
            to use API keys with limited permissions (spot trading only) and avoid keys with
            withdrawal permissions.
          </div>
        </div>
      </div>
    </div>
  );
}
