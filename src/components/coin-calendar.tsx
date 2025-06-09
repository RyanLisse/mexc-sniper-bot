"use client";

import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMexcCalendar } from "@/src/hooks/use-mexc-data";
import type { CalendarEntry } from "@/src/schemas/mexc-schemas";
import { useMemo, useState } from "react";

// interface CoinListing {
//   symbol: string;
//   listingTime: string;
//   tradingStartTime: string;
//   projectName?: string;
// }

interface CoinCalendarProps {
  onDateSelect?: (date: Date) => void;
}

export function CoinCalendar({ onDateSelect }: CoinCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Use real MEXC calendar data
  const { data: mexcCalendarData, isLoading: mexcLoading, error: mexcError } = useMexcCalendar();

  // Filter listings by selected date
  const coinListings = useMemo(() => {
    if (!mexcCalendarData) return [];

    const selectedDateStr = selectedDate.toDateString();

    return mexcCalendarData
      .filter((entry: CalendarEntry) => {
        const listingDate = new Date(entry.firstOpenTime);
        return listingDate.toDateString() === selectedDateStr;
      })
      .map((entry: CalendarEntry) => ({
        symbol: entry.symbol,
        listingTime: new Date(entry.firstOpenTime).toISOString(),
        tradingStartTime: new Date(entry.firstOpenTime).toISOString(),
        projectName: entry.projectName,
      }));
  }, [mexcCalendarData, selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isTomorrow = (date: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  };

  const formatDate = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return date.toLocaleDateString();
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Select Date</CardTitle>
          <CardDescription>
            Choose a date to view coin listings. Today and tomorrow are highlighted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            className="rounded-md border"
            modifiers={{
              today: (date) => isToday(date),
              tomorrow: (date) => isTomorrow(date),
            }}
            modifiersStyles={{
              today: {
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
                fontWeight: "bold",
              },
              tomorrow: {
                backgroundColor: "hsl(var(--secondary))",
                color: "hsl(var(--secondary-foreground))",
                fontWeight: "bold",
              },
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coin Listings</CardTitle>
          <CardDescription>Listings for {formatDate(selectedDate)}</CardDescription>
        </CardHeader>
        <CardContent>
          {mexcLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading MEXC data...</span>
            </div>
          ) : mexcError ? (
            <div className="text-center text-red-400 p-8">
              <p>Error loading calendar data:</p>
              <p className="text-sm">{mexcError.message}</p>
            </div>
          ) : coinListings.length > 0 ? (
            <div className="space-y-3">
              {coinListings.map(
                (listing: {
                  symbol: string;
                  listingTime: string;
                  tradingStartTime: string;
                  projectName: string;
                }) => (
                  <div
                    key={`${listing.symbol}-${listing.listingTime}`}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex flex-col">
                      <Badge variant="outline" className="text-sm font-mono w-fit">
                        {listing.symbol}
                      </Badge>
                      {listing.projectName && (
                        <span className="text-xs text-muted-foreground mt-1">
                          {listing.projectName}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(listing.listingTime).toLocaleTimeString()}
                    </div>
                  </div>
                )
              )}
            </div>
          ) : mexcCalendarData ? (
            <div className="text-center text-muted-foreground p-8">
              <p>No listings for {formatDate(selectedDate)}</p>
              <p className="text-xs mt-1">Total listings available: {mexcCalendarData.length}</p>
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8">No calendar data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
