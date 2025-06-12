"use client";

import * as React from "react";
import { addDays, format, isSameDay, isToday, isTomorrow } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Calendar } from "@/src/components/ui/calendar";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { cn } from "@/src/lib/utils";

interface CoinDateSelectorProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date | undefined) => void;
  highlightDates?: Date[];
  className?: string;
}

export function CoinDateSelector({
  selectedDate,
  onDateSelect,
  highlightDates = [],
  className,
}: CoinDateSelectorProps) {
  const [date, setDate] = React.useState<Date | undefined>(selectedDate || new Date());

  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    onDateSelect?.(newDate);
  };

  // Today and tomorrow are highlighted by default
  const defaultHighlightDates = [new Date(), addDays(new Date(), 1)];
  const allHighlightDates = [...defaultHighlightDates, ...highlightDates];

  const isHighlightedDate = (checkDate: Date) => {
    return allHighlightDates.some((highlightDate) => isSameDay(checkDate, highlightDate));
  };

  const getDateLabel = (checkDate: Date) => {
    if (isToday(checkDate)) return "Today";
    if (isTomorrow(checkDate)) return "Tomorrow";
    return format(checkDate, "MMM d");
  };

  return (
    <Card className={cn("max-w-md", className)}>
      <CardHeader className="pb-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Select Date</h3>
          <p className="text-sm text-muted-foreground">
            Choose a date to view coin listings. Today and tomorrow are highlighted.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          defaultMonth={date}
          className="bg-transparent p-0"
          modifiers={{
            highlighted: (checkDate) => isHighlightedDate(checkDate),
            today: (checkDate) => isToday(checkDate),
          }}
          modifiersStyles={{
            highlighted: {
              backgroundColor: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              fontWeight: "600",
            },
            today: {
              backgroundColor: "hsl(var(--accent))",
              color: "hsl(var(--accent-foreground))",
              fontWeight: "600",
            },
          }}
          components={{
            IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
            IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
          }}
        />

        {/* Quick date selection buttons */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Today", value: 0 },
            { label: "Tomorrow", value: 1 },
            { label: "In 3 days", value: 3 },
            { label: "In a week", value: 7 },
          ].map((preset) => {
            const presetDate = addDays(new Date(), preset.value);
            const isSelected = date && isSameDay(date, presetDate);

            return (
              <Button
                key={preset.value}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => handleDateSelect(presetDate)}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>

        {/* Selected date display */}
        {date && (
          <div className="rounded-md bg-muted p-3 text-center">
            <p className="text-sm font-medium">Selected: {getDateLabel(date)}</p>
            <p className="text-xs text-muted-foreground">{format(date, "EEEE, MMMM d, yyyy")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
