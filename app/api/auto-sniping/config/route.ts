import { NextRequest, NextResponse } from "next/server";

// Auto-sniping configuration endpoint with proper schema
export async function GET() {
  try {
    const config = {
      enabled: true,
      maxPositionSize: 1000,
      takeProfitPercentage: 10,
      stopLossPercentage: 5,
      patternConfidenceThreshold: 75,
      maxConcurrentTrades: 3,
      enableSafetyChecks: true,
      enablePatternDetection: true,
    };
    
    return NextResponse.json({
      success: true,
      data: config,
      message: "Auto-sniping configuration retrieved successfully"
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to get auto-sniping configuration"
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle configuration updates
    const allowedConfigFields = [
      'enabled',
      'maxPositionSize',
      'takeProfitPercentage',
      'stopLossPercentage',
      'patternConfidenceThreshold',
      'maxConcurrentTrades',
      'enableSafetyChecks',
      'enablePatternDetection'
    ];

    // Validate configuration update
    const configUpdates: any = {};
    Object.keys(body).forEach(key => {
      if (allowedConfigFields.includes(key)) {
        configUpdates[key] = body[key];
      }
    });

    if (Object.keys(configUpdates).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid configuration fields provided'
      }, { status: 400 });
    }

    // Mock successful configuration update
    const updatedConfig = {
      enabled: true,
      maxPositionSize: 1000,
      takeProfitPercentage: 10,
      stopLossPercentage: 5,
      patternConfidenceThreshold: 75,
      maxConcurrentTrades: 3,
      enableSafetyChecks: true,
      enablePatternDetection: true,
      ...configUpdates,
    };

    return NextResponse.json({
      success: true,
      data: updatedConfig,
      message: "Configuration updated successfully"
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to update configuration"
    }, { status: 500 });
  }
}