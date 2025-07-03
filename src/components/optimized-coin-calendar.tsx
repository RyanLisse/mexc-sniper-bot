"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMexcCalendar } from "../hooks/use-mexc-data";

interface CoinListing {
  symbol: string;
  listingTime: string;
  tradingStartTime: string;
  projectName?: string;
}

interface CoinCalendarProps {
  onDateSelect?: (date: Date) => void;
}

// Calendar listing item component
const ListingItem = memo(({ listing }: { listing: CoinListing }) => (
  <div className="flex items-center justify-between p-3 border rounded-lg">
    <div className="flex flex-col">
      <Badge variant="outline" className="text-sm font-mono w-fit">
        {listing.symbol}
      </Badge>
      {listing.projectName && (
        <span className="text-xs text-muted-foreground mt-1">{listing.projectName}</span>
      )}
    </div>
    <div className="text-sm text-muted-foreground">
      {new Date(listing.listingTime).toLocaleTimeString()}
    </div>
  </div>
));
ListingItem.displayName = "ListingItem";

// Loading state component
const LoadingState = memo(() => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    <span className="ml-2 text-sm text-muted-foreground">Loading MEXC data...</span>
  </div>
));
LoadingState.displayName = "LoadingState";

// Error state component
const ErrorState = memo(({ error }: { error: Error }) => (
  <div className="text-center text-red-400 p-8">
    <p>Error loading calendar data:</p>
    <p className="text-sm">{error.message}</p>
  </div>
));
ErrorState.displayName = "ErrorState";

// Empty state component
const EmptyState = memo(
  ({ date, totalListings }: { date: string; totalListings: number }) => (
    <div className="text-center text-muted-foreground p-8">
      <p>No listings for {date}</p>
      <p className="text-xs mt-1">Total listings available: {totalListings}</p>
    </div>
  )
);
EmptyState.displayName = "EmptyState";

// Date formatting hook
const useDateFormatting = () => {
  const isToday = useCallback((date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }, []);

  const isTomorrow = useCallback((date: Date) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return date.toDateString() === tomorrow.toDateString();
  }, []);

  const formatDate = useCallback(
    (date: Date) => {
      if (isToday(date)) return "Today";
      if (isTomorrow(date)) return "Tomorrow";
      return date.toLocaleDateString();
    },
    [isToday, isTomorrow]
  );

  return { isToday, isTomorrow, formatDate };
};

// Main component with optimizations
export const OptimizedCoinCalendar = memo(({ onDateSelect }: CoinCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { data: mexcCalendarData, isLoading, error } = useMexcCalendar();
  const { isToday, isTomorrow, formatDate } = useDateFormatting();

  // Memoize filtered listings
  const coinListings = useMemo(() => {
    if (!mexcCalendarData) return [];

    const selectedDateStr = selectedDate.toDateString();

    return mexcCalendarData
      .filter((entry) => {
        const listingDate = new Date(entry.firstOpenTime);
        return listingDate.toDateString() === selectedDateStr;
      })
      .map((entry) => ({
        symbol: entry.symbol,
        listingTime: new Date(entry.firstOpenTime).toISOString(),
        tradingStartTime: new Date(entry.firstOpenTime).toISOString(),
        projectName: String(entry.projectName),
      }));
  }, [mexcCalendarData, selectedDate]);

  // Memoize date selection handler
  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      setSelectedDate(date);
      onDateSelect?.(date);
    },
    [onDateSelect]
  );

  // Memoize calendar modifiers
  const calendarModifiers = useMemo(
    () => ({
      today: (date: Date) => isToday(date),
      tomorrow: (date: Date) => isTomorrow(date),
    }),
    [isToday, isTomorrow]
  );

  // Memoize calendar modifier styles
  const calendarModifiersStyles = useMemo(
    () => ({
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
    }),
    []
  );

  const formattedDate = formatDate(selectedDate);

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
            modifiers={calendarModifiers}
            modifiersStyles={calendarModifiersStyles}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coin Listings</CardTitle>
          <CardDescription>Listings for {formattedDate}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error as Error} />
          ) : coinListings.length > 0 ? (
            <div className="space-y-3">
              {coinListings.map((listing) => (
                <ListingItem key={`${listing.symbol}-${listing.listingTime}`} listing={listing} />
              ))}
            </div>
          ) : mexcCalendarData ? (
            <EmptyState date={formattedDate} totalListings={mexcCalendarData.length} />
          ) : (
            <div className="text-center text-muted-foreground p-8">No calendar data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

OptimizedCoinCalendar.displayName = "OptimizedCoinCalendar";
