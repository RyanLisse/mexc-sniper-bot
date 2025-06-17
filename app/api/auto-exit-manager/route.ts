import { NextRequest, NextResponse } from "next/server";
import { exitManagerService } from "@/src/services/optimized-auto-exit-manager";

export async function GET() {
  try {
    const status = exitManagerService.getStatus();
    
    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("❌ Error getting auto exit manager status:", error);
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
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "start":
        await exitManagerService.start();
        return NextResponse.json({
          success: true,
          message: "Auto exit manager started",
          data: exitManagerService.getStatus(),
        });

      case "stop":
        exitManagerService.stop();
        return NextResponse.json({
          success: true,
          message: "Auto exit manager stopped",
          data: exitManagerService.getStatus(),
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
    console.error("❌ Error controlling auto exit manager:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to control auto exit manager",
      },
      { status: 500 }
    );
  }
}