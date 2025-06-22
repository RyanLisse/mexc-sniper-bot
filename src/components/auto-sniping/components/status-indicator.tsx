/**
 * Status Indicator Component
 *
 * Displays execution status with appropriate icon and styling
 */

import { Clock, PauseCircle, PlayCircle, StopCircle, XCircle } from "lucide-react";

interface StatusIndicatorProps {
  status: string;
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const getStatusProps = (status: string) => {
    switch (status) {
      case "active":
        return { icon: PlayCircle, color: "text-green-500", bg: "bg-green-50" };
      case "paused":
        return { icon: PauseCircle, color: "text-yellow-500", bg: "bg-yellow-50" };
      case "idle":
        return { icon: StopCircle, color: "text-gray-500", bg: "bg-gray-50" };
      case "error":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-50" };
      default:
        return { icon: Clock, color: "text-gray-400", bg: "bg-gray-50" };
    }
  };

  const { icon: Icon, color, bg } = getStatusProps(status);

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bg}`}>
      <Icon className={`h-5 w-5 ${color}`} />
      <span className={`text-sm font-medium ${color}`}>{status.toUpperCase()}</span>
    </div>
  );
}
