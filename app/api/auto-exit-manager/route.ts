import { NextRequest, NextResponse } from "next/server";
import { getCoreTrading } from "@/src/services/trading/consolidated/core-trading/base-service";

export async function GET() {
  try {
    const coreTrading = getCoreTrading();
    const status = await coreTrading.getStatus();
    
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("❌ Error getting auto exit manager status:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get auto exit manager status",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const coreTrading = getCoreTrading();
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start":
        await coreTrading.startExecution();
        return NextResponse.json({
          success: true,
          message: "Auto exit manager started",
          data: await coreTrading.getStatus(),
        });

      case "stop":
        await coreTrading.stopExecution();
        return NextResponse.json({
          success: true,
          message: "Auto exit manager stopped",
          data: await coreTrading.getStatus(),
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Use 'start' or 'stop'",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("❌ Error controlling auto exit manager:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to control auto exit manager",
      },
      { status: 500 }
    );
  }
}