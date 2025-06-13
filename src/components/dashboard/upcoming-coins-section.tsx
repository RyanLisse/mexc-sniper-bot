"use client";

import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { useUpcomingLaunches } from "@/src/hooks/use-mexc-data";
import { Calendar, Clock, RefreshCw, TrendingUp } from "lucide-react";
import { useMemo } from "react";

interface CalendarEntry {
  firstOpenTime: string | number;
  vcoinId: string;
  symbol: string;
  projectName?: string;
}

interface GroupedLaunches {
  today: CalendarEntry[];
  tomorrow: CalendarEntry[];
}

export function UpcomingCoinsSection() {
  const { data: upcomingLaunches, isLoading, error } = useUpcomingLaunches();

  // Group launches by today/tomorrow and sort by earliest launch time
  const groupedLaunches = useMemo<GroupedLaunches>(() => {
    if (!Array.isArray(upcomingLaunches)) {
      return { today: [], tomorrow: [] };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const endOfTomorrow = new Date(startOfTomorrow.getTime() + 24 * 60 * 60 * 1000);

    const today: CalendarEntry[] = [];
    const tomorrow: CalendarEntry[] = [];

    upcomingLaunches.forEach((entry: CalendarEntry) => {
      try {
        const launchTime = new Date(entry.firstOpenTime);

        if (launchTime >= startOfToday && launchTime < startOfTomorrow) {
          today.push(entry);
        } else if (launchTime >= startOfTomorrow && launchTime < endOfTomorrow) {
          tomorrow.push(entry);
        }
      } catch (_error) {
        console.warn("Invalid date in calendar entry:", entry.firstOpenTime);
      }
    });

    // Sort by earliest launch time (ascending)
    const sortByLaunchTime = (a: CalendarEntry, b: CalendarEntry) => {
      const timeA = new Date(a.firstOpenTime).getTime();
      const timeB = new Date(b.firstOpenTime).getTime();
      return timeA - timeB;
    };

    today.sort(sortByLaunchTime);
    tomorrow.sort(sortByLaunchTime);

    return { today, tomorrow };
  }, [upcomingLaunches]);

  const formatLaunchTime = (firstOpenTime: string | number) => {
    try {
      const date = new Date(firstOpenTime);
      return {
        time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        hoursUntil: Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60)),
      };
    } catch {
      return { time: "Invalid time", hoursUntil: 0 };
    }
  };

  const getTimeUntilColor = (hoursUntil: number) => {
    if (hoursUntil <= 2) return "bg-red-500/10 text-red-600 border-red-500/20";
    if (hoursUntil <= 6) return "bg-orange-500/10 text-orange-600 border-orange-500/20";
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
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
          <CardDescription>Coins launching today - sorted by earliest launch time</CardDescription>
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
                const { time, hoursUntil } = formatLaunchTime(entry.firstOpenTime);
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
                        <h4 className="font-medium">{entry.projectName || entry.symbol}</h4>
                        <p className="text-sm text-muted-foreground">{entry.symbol}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Clock className="h-3 w-3" />
                          {time}
                        </div>
                        <Badge variant="outline" className={getTimeUntilColor(hoursUntil)}>
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
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
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
                const { time, hoursUntil } = formatLaunchTime(entry.firstOpenTime);
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
                        <h4 className="font-medium">{entry.projectName || entry.symbol}</h4>
                        <p className="text-sm text-muted-foreground">{entry.symbol}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <Clock className="h-3 w-3" />
                          {time}
                        </div>
                        <Badge variant="outline" className={getTimeUntilColor(hoursUntil)}>
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
              Total upcoming launches:{" "}
              <span className="font-medium text-foreground">
                {groupedLaunches.today.length + groupedLaunches.tomorrow.length}
              </span>
            </div>
            <div className="flex gap-2">
              <Badge
                variant="outline"
                className="bg-green-500/10 text-green-600 border-green-500/20"
              >
                Today: {groupedLaunches.today.length}
              </Badge>
              <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                Tomorrow: {groupedLaunches.tomorrow.length}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
