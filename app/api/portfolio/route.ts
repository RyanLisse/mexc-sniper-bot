import { NextRequest, NextResponse } from "next/server";

// Simplified portfolio endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required'
      }, { status: 400 });
    }

    // Mock portfolio data
    const portfolio = {
      activePositions: [
        {
          id: '1',
          symbolName: 'BTCUSDT',
          positionSizeUsdt: 100,
          executionPrice: 45000,
          currentPrice: 46000,
          unrealizedPnL: 2.22,
          unrealizedPnLPercent: 2.22,
          status: 'active'
        }
      ],
      metrics: {
        totalActivePositions: 1,
        totalUnrealizedPnL: 2.22,
        totalCompletedTrades: 5,
        successfulTrades: 4,
        successRate: 80,
        totalCapitalDeployed: 500
      },
      recentActivity: [
        {
          id: '1',
          symbol: 'BTCUSDT',
          action: 'buy',
          status: 'success',
          timestamp: new Date().toISOString(),
          quantity: 0.002,
          price: 45000,
          totalCost: 90
        }
      ]
    };

    return NextResponse.json({
      success: true,
      data: portfolio,
      message: "Portfolio data retrieved successfully"
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to fetch portfolio"
    }, { status: 500 });
  }
}