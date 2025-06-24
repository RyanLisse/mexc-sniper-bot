"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useBreakpoints,
  useDeviceType,
  useIsMobile,
  useMobileDevice,
  useOrientation,
} from "../hooks/use-mobile-clean";
import { RESPONSIVE_CONFIG, ResponsiveClassNames } from "../lib/responsive-utils-clean";
import { createSafeLogger } from "../lib/structured-logger";
import { cn } from "../lib/utils";

/**
 * Mobile Test Dashboard Component
 * Demonstrates mobile detection hooks and responsive system functionality
 * Used for testing and validation of mobile-first responsive infrastructure
 */
const logger = createSafeLogger("mobile-test-dashboard");

export function MobileTestDashboard() {
  const isMobile = useIsMobile();
  const deviceType = useDeviceType();
  const breakpoints = useBreakpoints();
  const orientation = useOrientation();
  const { isMobileDevice, isTouchDevice } = useMobileDevice();

  const getDeviceInfo = () => {
    return {
      screenWidth: typeof window !== "undefined" ? window.innerWidth : 0,
      screenHeight: typeof window !== "undefined" ? window.innerHeight : 0,
      userAgent: typeof window !== "undefined" ? navigator.userAgent : "SSR",
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    };
  };

  const deviceInfo = getDeviceInfo();

  return (
    <div className={cn("p-4 space-y-6", isMobile ? "content-mobile" : "content-desktop")}>
      <div className="text-center space-y-2">
        <h1
          className={cn(
            "font-bold tracking-tight",
            ResponsiveClassNames.textSize("2xl", "3xl", "4xl")
          )}
        >
          Mobile Detection & Responsive Test Dashboard
        </h1>
        <p className="text-muted-foreground">
          Testing mobile detection hooks and responsive breakpoint system
        </p>
      </div>

      {/* Mobile Detection Status */}
      <Card className={cn(isMobile && "trading-panel-mobile")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Mobile Detection Status
            <Badge variant={isMobile ? "default" : "secondary"}>
              {isMobile ? "Mobile" : "Desktop"}
            </Badge>
          </CardTitle>
          <CardDescription>Real-time mobile detection using useIsMobile hook</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn("grid gap-4", ResponsiveClassNames.gridCols(1, 2, 3))}>
            <div className="space-y-2">
              <div className="text-sm font-medium">Device Type</div>
              <Badge variant="outline" className="w-full justify-center">
                {deviceType}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Orientation</div>
              <Badge variant="outline" className="w-full justify-center">
                {orientation}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Touch Device</div>
              <Badge
                variant={isTouchDevice ? "default" : "secondary"}
                className="w-full justify-center"
              >
                {isTouchDevice ? "Touch" : "No Touch"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakpoint Status */}
      <Card className={cn(isMobile && "trading-panel-mobile")}>
        <CardHeader>
          <CardTitle>Responsive Breakpoints</CardTitle>
          <CardDescription>Current active breakpoints using useBreakpoints hook</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={cn("grid gap-3", ResponsiveClassNames.gridCols(2, 3, 5))}>
            {Object.entries(breakpoints).map(([breakpoint, isActive]) => (
              <div key={breakpoint} className="text-center space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide">{breakpoint}</div>
                <Badge variant={isActive ? "default" : "secondary"}>
                  {isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Device Information */}
      <Card className={cn(isMobile && "trading-panel-mobile")}>
        <CardHeader>
          <CardTitle>Device Information</CardTitle>
          <CardDescription>Technical device details and capabilities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn("grid gap-4", ResponsiveClassNames.gridCols(1, 2, 2))}>
            <div className="space-y-2">
              <div className="text-sm font-medium">Screen Resolution</div>
              <div className="text-sm text-muted-foreground">
                {deviceInfo.screenWidth} × {deviceInfo.screenHeight}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">Pixel Ratio</div>
              <div className="text-sm text-muted-foreground">{deviceInfo.devicePixelRatio}x</div>
            </div>
            <div className="space-y-2 col-span-full">
              <div className="text-sm font-medium">User Agent</div>
              <div className="text-xs text-muted-foreground break-all p-2 bg-muted rounded">
                {deviceInfo.userAgent}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Responsive Grid Demo */}
      <Card className={cn(isMobile && "trading-panel-mobile")}>
        <CardHeader>
          <CardTitle>Responsive Grid System Demo</CardTitle>
          <CardDescription>Mobile-first grid that adapts to screen size</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid-responsive">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center"
              >
                <div className="text-sm font-medium">Grid Item {i + 1}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {isMobile ? "Mobile" : deviceType} View
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Responsive Configuration Demo */}
      <Card className={cn(isMobile && "trading-panel-mobile")}>
        <CardHeader>
          <CardTitle>Responsive Configuration</CardTitle>
          <CardDescription>Configuration values for different device types</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn("grid gap-4", ResponsiveClassNames.gridCols(1, 1, 2))}>
            <div className="space-y-3">
              <h4 className="font-medium">Sidebar Configuration</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Mobile Width:</span>
                  <span className="font-mono">{RESPONSIVE_CONFIG.sidebar.widthMobile}</span>
                </div>
                <div className="flex justify-between">
                  <span>Desktop Width:</span>
                  <span className="font-mono">{RESPONSIVE_CONFIG.sidebar.widthDesktop}</span>
                </div>
                <div className="flex justify-between">
                  <span>Icon Width:</span>
                  <span className="font-mono">{RESPONSIVE_CONFIG.sidebar.widthIcon}</span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Card Configuration</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Mobile Padding:</span>
                  <span className="font-mono">{RESPONSIVE_CONFIG.cards.paddingMobile}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tablet Padding:</span>
                  <span className="font-mono">{RESPONSIVE_CONFIG.cards.paddingTablet}</span>
                </div>
                <div className="flex justify-between">
                  <span>Desktop Padding:</span>
                  <span className="font-mono">{RESPONSIVE_CONFIG.cards.paddingDesktop}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div
        className={cn("flex gap-4", isMobile ? "trading-controls-mobile" : "flex-row flex-wrap")}
      >
        <Button
          onClick={() => window.location.reload()}
          className={cn(isMobile && "trading-button-mobile")}
        >
          Refresh Test
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const details = {
              isMobile,
              deviceType,
              breakpoints,
              orientation,
              isMobileDevice,
              isTouchDevice,
              deviceInfo,
            };
            logger.info("Mobile Detection Details:", details);
            alert("Check console for detailed mobile detection info");
          }}
          className={cn(isMobile && "trading-button-mobile")}
        >
          Log Details
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            const userAgent = navigator.userAgent;
            const simulatedMobile =
              userAgent.includes("Mobile") ||
              userAgent.includes("Android") ||
              userAgent.includes("iPhone");
            alert(`Real Mobile Device: ${isMobileDevice}\\nUser Agent Mobile: ${simulatedMobile}`);
          }}
          className={cn(isMobile && "trading-button-mobile")}
        >
          Device Check
        </Button>
      </div>

      {/* Responsive Utility Classes Demo */}
      <Card className={cn(isMobile && "trading-panel-mobile")}>
        <CardHeader>
          <CardTitle>Responsive Utility Classes</CardTitle>
          <CardDescription>Testing responsive visibility and layout classes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="mobile-only p-3 bg-green-100 text-green-800 rounded border">
              ✅ This content is only visible on mobile devices
            </div>
            <div className="tablet-only p-3 bg-blue-100 text-blue-800 rounded border">
              📱 This content is only visible on tablet devices
            </div>
            <div className="desktop-only p-3 bg-purple-100 text-purple-800 rounded border">
              🖥️ This content is only visible on desktop devices
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
