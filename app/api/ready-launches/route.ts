import { NextRequest, NextResponse } from "next/server";

interface CalendarEntry {
  vcoinId: string;
  symbolName: string;
  firstOpenTime: number;
  projectName: string;
}

/**
 * API Route: Ready Launches
 * 
 * Returns coin launches that are ready (within 4 hours) or historical data
 * for calculating percentage changes in the dashboard metrics.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate");
    
    // Fetch calendar data from the existing MEXC calendar API
    // Use the same base URL as the current request to ensure port compatibility
    const { protocol, host } = new URL(request.url);
    const baseUrl = `${protocol}//${host}`;
    let calendarUrl = `${baseUrl}/api/mexc/calendar`;
    
    // If fromDate is provided, add it as a query parameter
    if (fromDate) {
      calendarUrl += `?fromDate=${encodeURIComponent(fromDate)}`;
    }
    
    const calendarResponse = await fetch(calendarUrl, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    });
    
    if (!calendarResponse.ok) {
      console.error('Failed to fetch calendar data:', calendarResponse.status);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch calendar data',
        data: []
      });
    }
    
    const calendarResult = await calendarResponse.json();
    
    if (!calendarResult.success) {
      return NextResponse.json({
        success: false,
        error: calendarResult.error || 'Calendar API error',
        data: []
      });
    }
    
    const calendarData: CalendarEntry[] = Array.isArray(calendarResult.data) 
      ? calendarResult.data 
      : [];
    
    // If fromDate is provided, return historical data (for percentage calculations)
    if (fromDate) {
      const fromTimestamp = new Date(fromDate).getTime();
      const toTimestamp = new Date().getTime();
      
      const historicalReadyLaunches = calendarData.filter((entry: CalendarEntry) => {
        try {
          const launchTime = new Date(entry.firstOpenTime).getTime();
          return launchTime >= fromTimestamp && launchTime <= toTimestamp;
        } catch (error) {
          console.warn('Invalid date in calendar entry:', entry.firstOpenTime);
          return false;
        }
      });
      
      return NextResponse.json({
        success: true,
        data: historicalReadyLaunches,
        meta: {
          fromDate,
          count: historicalReadyLaunches.length,
          period: 'historical'
        }
      });
    }
    
    // Default behavior: return launches ready within 4 hours
    const now = new Date();
    const hours4 = 4 * 60 * 60 * 1000;
    
    const readyLaunches = calendarData.filter((entry: CalendarEntry) => {
      try {
        const launchTime = new Date(entry.firstOpenTime);
        return (
          launchTime.getTime() > now.getTime() && 
          launchTime.getTime() < now.getTime() + hours4
        );
      } catch (error) {
        console.warn('Invalid date in calendar entry:', entry.firstOpenTime);
        return false;
      }
    });
    
    return NextResponse.json({
      success: true,
      data: readyLaunches,
      meta: {
        count: readyLaunches.length,
        period: 'next_4_hours',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Ready launches API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      data: []
    });
  }
}