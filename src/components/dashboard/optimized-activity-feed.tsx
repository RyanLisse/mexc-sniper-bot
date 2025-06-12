"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { useTimeFormatting } from "@/src/hooks/use-time-formatting";
import { Activity, ArrowUpRight, Bot, Clock, Eye, Zap } from "lucide-react";
import React, { useMemo } from "react";

interface ActivityItem {
  id: string;
  type: "pattern" | "calendar" | "snipe" | "analysis";
  message: string;
  timestamp: string;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
  isLoading?: boolean;
  className?: string;
}

// Activity type configuration
const ACTIVITY_CONFIG = {
  pattern: {
    icon: ArrowUpRight,
    iconColor: "text-green-500",
    dotColor: "bg-green-500",
    badgeColor: "bg-green-100 text-green-800",
  },
  calendar: {
    icon: Eye,
    iconColor: "text-blue-500",
    dotColor: "bg-blue-500",
    badgeColor: "bg-blue-100 text-blue-800",
  },
  snipe: {
    icon: Zap,
    iconColor: "text-green-500",
    dotColor: "bg-green-500",
    badgeColor: "bg-green-100 text-green-800",
  },
  analysis: {
    icon: Bot,
    iconColor: "text-purple-500",
    dotColor: "bg-purple-500",
    badgeColor: "bg-purple-100 text-purple-800",
  },
} as const;

// Memoized activity item component
const ActivityListItem = React.memo(
  ({
    activity,
  }: {
    activity: ActivityItem;
  }) => {
    const { formatTimeAgo } = useTimeFormatting();
    const config = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.analysis;
    const Icon = config.icon;

    return (
      <div className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 animate-fade-in">
        <div
          className={`w-2 h-2 ${config.dotColor} rounded-full ${
            activity.type === "pattern" ? "animate-pulse" : ""
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <p className="text-sm font-medium text-gray-900 truncate">{activity.message}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badgeColor}`}>
              {activity.type}
            </span>
          </div>
          <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
        </div>
        <div className="flex-shrink-0">
          <Icon className={`h-4 w-4 ${config.iconColor}`} />
        </div>
      </div>
    );
  }
);
ActivityListItem.displayName = "ActivityListItem";

// Loading skeleton component
const LoadingSkeleton = React.memo(() => (
  <>
    {Array.from({ length: 5 }, (_, i) => `loading-${i}`).map((key) => (
      <div key={key} className="animate-pulse">
        <div className="flex items-center space-x-3 p-3 bg-gray-100 rounded-lg">
          <div className="w-2 h-2 bg-gray-300 rounded-full" />
          <div className="flex-1 space-y-1">
            <div className="h-4 bg-gray-300 rounded w-3/4" />
            <div className="h-3 bg-gray-300 rounded w-1/4" />
          </div>
          <div className="w-4 h-4 bg-gray-300 rounded" />
        </div>
      </div>
    ))}
  </>
));
LoadingSkeleton.displayName = "LoadingSkeleton";

// Empty state component
const EmptyState = React.memo(() => (
  <div className="text-center text-gray-500 py-8">
    <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
    <p className="text-sm font-medium">No recent activity</p>
    <p className="text-xs text-gray-400 mt-1">Start discovery to see live updates</p>
  </div>
));
EmptyState.displayName = "EmptyState";

// Header component
const FeedHeader = React.memo(
  ({
    activityCount,
  }: {
    activityCount: number;
  }) => (
    <CardTitle className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <Clock className="h-5 w-5 text-blue-500" />
        <span>Recent Activity</span>
      </div>
      {activityCount > 0 && (
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {activityCount} events
        </span>
      )}
    </CardTitle>
  )
);
FeedHeader.displayName = "FeedHeader";

// Main component with optimizations
export const OptimizedActivityFeed = React.memo(
  ({ activities = [], isLoading = false, className }: ActivityFeedProps) => {
    // Memoize sorted activities to prevent recalculation
    const sortedActivities = useMemo(
      () =>
        [...activities].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ),
      [activities]
    );

    return (
      <Card className={className}>
        <CardHeader>
          <FeedHeader activityCount={activities.length} />
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <LoadingSkeleton />
          ) : sortedActivities.length > 0 ? (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {sortedActivities.map((activity) => (
                <ActivityListItem key={activity.id} activity={activity} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>
    );
  }
);

OptimizedActivityFeed.displayName = "OptimizedActivityFeed";
