"use client";

import { Calendar, Clock, RefreshCw, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  useMexcCalendar,
  useRefreshMexcCalendar,
} from "../../hooks/use-mexc-data";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

interface UpcomingCalendarEntry {
  firstOpenTime?: string | number;
  vcoinId?: string;
  symbol?: string;
  projectName?: string;
}

interface GroupedLaunches {
  today: UpcomingCalendarEntry[];
  tomorrow: UpcomingCalendarEntry[];
}

export function UpcomingCoinsSection() {
  // Use the main calendar hook to get all data instead of filtered data
  const { data: allCalendarData, isLoading, error } = useMexcCalendar();
  const refreshCalendar = useRefreshMexcCalendar();

  // Group launches by today/tomorrow and sort by earliest launch time
  const groupedLaunches = useMemo<GroupedLaunches>(() => {
    if (!Array.isArray(allCalendarData)) {
      return { today: [], tomorrow: [] };
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfTomorrow = new Date(
      startOfToday.getTime() + 24 * 60 * 60 * 1000
    );
    const endOfTomorrow = new Date(
      startOfTomorrow.getTime() + 24 * 60 * 60 * 1000
    );

    const today: UpcomingCalendarEntry[] = [];
    const tomorrow: UpcomingCalendarEntry[] = [];

    allCalendarData.forEach((entry: UpcomingCalendarEntry) => {
      try {
        if (!entry.firstOpenTime) return;
        const launchTime = new Date(entry.firstOpenTime);

        if (launchTime >= startOfToday && launchTime < startOfTomorrow) {
          today.push(entry);
        } else if (
          launchTime >= startOfTomorrow &&
          launchTime < endOfTomorrow
        ) {
          tomorrow.push(entry);
        }
      } catch (_error) {
        console.warn("Invalid date in calendar entry:", {
          firstOpenTime: entry.firstOpenTime,
        });
      }
    });

    // Sort by earliest launch time (ascending)
    const sortByLaunchTime = (
      a: UpcomingCalendarEntry,
      b: UpcomingCalendarEntry
    ) => {
      const timeA = a.firstOpenTime ? new Date(a.firstOpenTime).getTime() : 0;
      const timeB = b.firstOpenTime ? new Date(b.firstOpenTime).getTime() : 0;
      return timeA - timeB;
    };

    today.sort(sortByLaunchTime);
    tomorrow.sort(sortByLaunchTime);

    return { today, tomorrow };
  }, [allCalendarData]);

  const formatLaunchTime = (firstOpenTime: string | number) => {
    try {
      const date = new Date(firstOpenTime);
      return {
        time: date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        hoursUntil: Math.floor(
          (date.getTime() - Date.now()) / (1000 * 60 * 60)
        ),
      };
    } catch {
      return { time: "Invalid time", hoursUntil: 0 };
    }
  };

  const getTimeUntilColor = (hoursUntil: number) => {
    if (hoursUntil <= 2) return "bg-red-500/10 text-red-600 border-red-500/20";
    if (hoursUntil <= 6)
      return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>Failed to load upcoming coins</p>
            <p className="text-sm mt-1">{error.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshCalendar.mutate()}
              disabled={refreshCalendar.isPending}
              className="mt-3"
            >
              {refreshCalendar.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Information Notice */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-1 bg-blue-500/10 rounded">
            <Calendar className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
              About Token Names
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-200 mt-1">
              MEXC reveals actual token names and symbols closer to launch time
              for security reasons. Current entries show placeholder IDs that
              will be updated with real names as launch approaches.
            </p>
          </div>
        </div>
      </div>

      {/* Today's Launches */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            <CardTitle className="text-green-600">Today's Launches</CardTitle>
            <Badge
              variant="secondary"
              className="bg-green-500/10 text-green-600 border-green-500/20"
            >
              {groupedLaunches.today.length}
            </Badge>
          </div>
          <CardDescription>
            Coins launching today - sorted by earliest launch time
            <Badge variant="outline" className="ml-2 text-xs">
              Total in calendar: {allCalendarData?.length || 0}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupedLaunches.today.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No coins launching today</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedLaunches.today.map((entry, index) => {
                const { time, hoursUntil } = formatLaunchTime(
                  entry.firstOpenTime || ""
                );
                return (
                  <div
                    key={`${entry.vcoinId}-${index}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 rounded-lg">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {entry.projectName !== entry.vcoinId
                            ? entry.projectName
                            : `Upcoming Launch #${index + 1}`}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {entry.symbol !== entry.vcoinId
                            ? entry.symbol
                            : `${entry.vcoinId?.slice(0, 6)?.toUpperCase()}...`}
                        </p>
                        <p className="text-xs text-orange-600">
                          ⏳ Token name revealed closer to launch
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Clock className="h-3 w-3" />
                          {time}
                        </div>
                        <Badge
                          variant="outline"
                          className={getTimeUntilColor(hoursUntil)}
                        >
                          {hoursUntil <= 0 ? "Now" : `${hoursUntil}h`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tomorrow's Launches */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-blue-600">Tomorrow's Launches</CardTitle>
            <Badge
              variant="secondary"
              className="bg-blue-500/10 text-blue-600 border-blue-500/20"
            >
              {groupedLaunches.tomorrow.length}
            </Badge>
          </div>
          <CardDescription>
            Coins launching tomorrow - sorted by earliest launch time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupedLaunches.tomorrow.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No coins launching tomorrow</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedLaunches.tomorrow.map((entry, index) => {
                const { time, hoursUntil } = formatLaunchTime(
                  entry.firstOpenTime || ""
                );
                return (
                  <div
                    key={`${entry.vcoinId}-${index}`}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {entry.projectName !== entry.vcoinId
                            ? entry.projectName
                            : `Tomorrow Launch #${index + 1}`}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {entry.symbol !== entry.vcoinId
                            ? entry.symbol
                            : `${entry.vcoinId?.slice(0, 6)?.toUpperCase()}...`}
                        </p>
                        <p className="text-xs text-orange-600">
                          ⏳ Token name revealed closer to launch
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Clock className="h-3 w-3" />
                          {time}
                        </div>
                        <Badge
                          variant="outline"
                          className={getTimeUntilColor(hoursUntil)}
                        >
                          {hoursUntil}h
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Upcoming launches (next 48h):{" "}
              <span className="font-medium text-foreground">
                {groupedLaunches.today.length + groupedLaunches.tomorrow.length}
              </span>
              {Array.isArray(allCalendarData) && (
                <span className="ml-2">
                  (Total: {allCalendarData.length} in calendar)
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Badge
                variant="outline"
                className="bg-green-500/10 text-green-600 border-green-500/20"
              >
                Today: {groupedLaunches.today.length}
              </Badge>
              <Badge
                variant="outline"
                className="bg-blue-500/10 text-blue-600 border-blue-500/20"
              >
                Tomorrow: {groupedLaunches.tomorrow.length}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refreshCalendar.mutate()}
                disabled={refreshCalendar.isPending}
              >
                {refreshCalendar.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Add default export for dynamic imports
export default UpcomingCoinsSection;
