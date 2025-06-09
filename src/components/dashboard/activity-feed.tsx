"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Activity, ArrowUpRight, Bot, Clock, Eye, Zap } from "lucide-react";

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

export function ActivityFeed({ activities = [], isLoading = false, className }: ActivityFeedProps) {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "pattern":
        return <ArrowUpRight className="h-4 w-4 text-green-500" />;
      case "calendar":
        return <Eye className="h-4 w-4 text-blue-500" />;
      case "snipe":
        return <Zap className="h-4 w-4 text-green-500" />;
      case "analysis":
        return <Bot className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "pattern":
        return "bg-green-500";
      case "calendar":
        return "bg-blue-500";
      case "snipe":
        return "bg-green-500";
      case "analysis":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const getActivityBadgeColor = (type: string) => {
    switch (type) {
      case "pattern":
        return "bg-green-100 text-green-800";
      case "calendar":
        return "bg-blue-100 text-blue-800";
      case "snipe":
        return "bg-green-100 text-green-800";
      case "analysis":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <span>Recent Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={`activity-loading-${i}`} className="animate-pulse">
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <span>Recent Activity</span>
          </div>
          {activities.length > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {activities.length} events
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.length > 0 ? (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 animate-fade-in"
              >
                <div
                  className={`w-2 h-2 ${getActivityColor(activity.type)} rounded-full ${
                    activity.type === "pattern" ? "animate-pulse" : ""
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{activity.message}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${getActivityBadgeColor(activity.type)}`}
                    >
                      {activity.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                </div>
                <div className="flex-shrink-0">{getActivityIcon(activity.type)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No recent activity</p>
            <p className="text-xs text-gray-400 mt-1">Start discovery to see live updates</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
