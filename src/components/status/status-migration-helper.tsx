"use client";
import { AlertTriangle, ArrowRight, CheckCircle, FileText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

/**
 * Status Migration Helper Component
 *
 * This component helps developers migrate from individual status components
 * to the centralized status management system.
 */

export function StatusMigrationHelper() {
  const migrationSteps = [
    {
      title: "Wrap your app with StatusProvider",
      description:
        "Add StatusProviderWrapper to your root layout or main app component",
      code: `import { StatusProviderWrapper } from '@/src/components/providers/status-provider-wrapper';

export default function RootLayout({ children }) {
  return (
    <StatusProviderWrapper>
      {children}
    </StatusProviderWrapper>
  );
}`,
      status: "required",
    },
    {
      title: "Replace EnhancedCredentialStatus",
      description:
        "Upgrade to the latest V3 version with enhanced connectivity features",
      code: `// Old way (basic status)
import { EnhancedCredentialStatus } from '@/src/components/enhanced-credential-status';

// Latest way (enhanced connectivity + health monitoring)
import { EnhancedCredentialStatusV3 } from '@/src/components/enhanced-credential-status-v3';

<EnhancedCredentialStatusV3 
  showDetailsButton={true} 
  showHealthMetrics={true} 
  showTrends={true} 
  autoRefresh={true} 
/>`,
      status: "critical",
    },
    {
      title: "Replace WorkflowStatusCard",
      description:
        "Update workflow status components to use centralized status",
      code: `// Old way
import { WorkflowStatusCard } from '@/src/components/dashboard/workflow-status-card';

// New way
import { WorkflowStatusCardV2 } from '@/src/components/dashboard/workflow-status-card-v2';

<WorkflowStatusCardV2 />`,
      status: "critical",
    },
    {
      title: "Use unified status hooks",
      description: "Replace individual status hooks with centralized versions",
      code: `// Old way (multiple sources of truth)
const { data: connectivity } = useMexcConnectivity();

// New way (single source of truth)
import { useStatus, useCredentialStatus } from '@/src/contexts/status-context-v2';

const { status, refreshCredentials } = useStatus();
const credentials = useCredentialStatus();`,
      status: "recommended",
    },
    {
      title: "Add unified status displays",
      description: "Use new unified components for consistent status display",
      code: `import { 
  UnifiedStatusCard, 
  UnifiedStatusBadge, 
  MiniStatusDisplay 
} from '@/src/components/status/unified-status-display';

// For main dashboard
<UnifiedStatusCard />

// For header/navigation
<UnifiedStatusBadge />

// For compact areas
<MiniStatusDisplay />`,
      status: "recommended",
    },
    {
      title: "Update custom status components",
      description:
        "Modify any custom status components to use the centralized context",
      code: `// In your custom component
import { useStatus } from '@/src/contexts/status-context-v2';

function MyCustomStatus() {
  const { status, getOverallStatus, refreshAll } = useStatus();
  
  return (
    <div>
      Status: {getOverallStatus()}
      Network: {status.network.connected ? 'OK' : 'Error'}
      Credentials: {status.credentials.isValid ? 'Valid' : 'Invalid'}
    </div>
  );
}`,
      status: "optional",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "required":
        return <Badge variant="destructive">Required</Badge>;
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "recommended":
        return <Badge variant="secondary">Recommended</Badge>;
      case "optional":
        return <Badge variant="outline">Optional</Badge>;
      default:
        return <Badge variant="outline">Info</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ArrowRight className="h-5 w-5" />
            <span>Status System Migration Guide</span>
          </CardTitle>
          <CardDescription>
            Follow these steps to eliminate contradictory status messages and
            implement centralized status management throughout your application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Migration Benefits</AlertTitle>
            <AlertDescription>
              • Eliminates contradictory status messages across components
              <br />• Provides single source of truth for all status information
              <br />• Enables real-time status synchronization
              <br />• Improves user experience with consistent status display
              <br />• Reduces development complexity with unified status hooks
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {migrationSteps.map((step, index) => (
          <Card key={`migration-step-${index}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Step {index + 1}: {step.title}
                </CardTitle>
                {getStatusBadge(step.status)}
              </div>
              <CardDescription>{step.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4">
                <pre className="text-sm overflow-x-auto">
                  <code>{step.code}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Important Notes</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Breaking Changes</AlertTitle>
            <AlertDescription>
              The V2 components are not drop-in replacements. You'll need to
              update imports and remove any custom status logic that conflicts
              with the centralized system.
            </AlertDescription>
          </Alert>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Testing</AlertTitle>
            <AlertDescription>
              After migration, test all status displays to ensure they show
              consistent information. Pay special attention to error states and
              loading conditions.
            </AlertDescription>
          </Alert>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Performance</AlertTitle>
            <AlertDescription>
              The centralized system includes automatic refresh and caching. You
              may need to adjust refresh intervals based on your application's
              performance requirements.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Component Mapping</span>
          </CardTitle>
          <CardDescription>
            Reference for replacing existing components with V2 versions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4 p-3 border rounded-lg">
              <div className="font-medium">Old Component</div>
              <div className="font-medium">New Component</div>
              <div className="font-medium">Priority</div>
            </div>
            <div className="grid grid-cols-3 gap-4 p-3 border rounded-lg text-sm">
              <code>EnhancedCredentialStatus</code>
              <code>EnhancedCredentialStatusV3</code>
              <Badge variant="destructive" className="w-fit">
                Critical
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 p-3 border rounded-lg text-sm">
              <code>WorkflowStatusCard</code>
              <code>WorkflowStatusCardV2</code>
              <Badge variant="destructive" className="w-fit">
                Critical
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 p-3 border rounded-lg text-sm">
              <code>useMexcConnectivity</code>
              <code>useStatus</code>
              <Badge variant="secondary" className="w-fit">
                Recommended
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4 p-3 border rounded-lg text-sm">
              <code>Custom status displays</code>
              <code>UnifiedStatusDisplay components</code>
              <Badge variant="outline" className="w-fit">
                Optional
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default StatusMigrationHelper;
