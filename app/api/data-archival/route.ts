import { type NextRequest, NextResponse } from "next/server";
import { dataArchivalService } from "@/src/services/data/data-archival-service";

export async function GET() {
  try {
    const [status, stats] = await Promise.all([
      dataArchivalService.getStatus(),
      dataArchivalService.getArchivalStats(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        status,
        stats,
      },
    });
  } catch (error) {
    console.error("❌ Error getting data archival status:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get data archival status",
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
        await dataArchivalService.startArchival();
        return NextResponse.json({
          success: true,
          message: "Data archival service started",
          data: dataArchivalService.getStatus(),
        });

      case "stop":
        dataArchivalService.stopArchival();
        return NextResponse.json({
          success: true,
          message: "Data archival service stopped",
          data: dataArchivalService.getStatus(),
        });

      case "manual-archive": {
        const result = await dataArchivalService.triggerManualArchival();
        return NextResponse.json({
          success: result.success,
          message: result.success
            ? `Manual archival completed. ${result.recordsArchived} records archived.`
            : `Manual archival failed: ${result.error}`,
          data: {
            recordsArchived: result.recordsArchived,
            error: result.error,
          },
        });
      }

      case "stats": {
        const stats = await dataArchivalService.getArchivalStats();
        return NextResponse.json({
          success: true,
          data: stats,
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid action. Use 'start', 'stop', 'manual-archive', or 'stats'",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("❌ Error controlling data archival service:", {
      error: error,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to control data archival service",
      },
      { status: 500 }
    );
  }
}
