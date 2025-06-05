"use client";

import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

interface CoinListing {
  symbol: string;
  listingTime: string;
  tradingStartTime: string;
}

interface CoinCalendarProps {
  onDateSelect?: (date: Date) => void;
}

export function CoinCalendar({ onDateSelect }: CoinCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [coinListings, setCoinListings] = useState<CoinListing[]>([]);
  const [loading, setLoading] = useState(false);

  const handleDateSelect = async (date: Date | undefined) => {
    if (!date) return;

    setSelectedDate(date);
    setLoading(true);

    try {
      // Fetch coin listings for selected date
      const response = await fetch(
        `/api/agents/mexc/listings?date=${date.toISOString().split("T")[0]}`
      );
      if (response.ok) {
        const data = await response.json();
        setCoinListings(data.listings || []);
      } else {
        setCoinListings([]);
      }
    } catch (error) {
      console.error("Failed to fetch coin listings:", error);
      setCoinListings([]);
    } finally {
      setLoading(false);
    }

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
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : coinListings.length > 0 ? (
            <div className="space-y-3">
              {coinListings.map((listing) => (
                <div
                  key={`${listing.symbol}-${listing.listingTime}`}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <Badge variant="outline" className="text-sm font-mono">
                      {listing.symbol}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(listing.listingTime).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground p-8">
              {isToday(selectedDate) || isTomorrow(selectedDate)
                ? "No listings found for this date"
                : "Select today or tomorrow to view available listings"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
