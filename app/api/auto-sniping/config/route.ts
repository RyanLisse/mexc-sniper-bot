import { NextRequest, NextResponse } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@/src/lib/api-response";
import { ConfigurationManager } from "@/src/lib/unified-configuration-management";
import { AutoSnipingConfigSchema } from "@/src/schemas/comprehensive-api-validation-schemas";

// Auto-sniping configuration endpoint backed by the configuration manager
export async function GET() {
  try {
    const configManager = ConfigurationManager.getInstance();
    const config = configManager.getSection("trading").autoSniping;

    return NextResponse.json(
      createSuccessResponse({
        config,
        message: "Auto-sniping configuration retrieved successfully",
      })
    );
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("Failed to get auto-sniping configuration", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = AutoSnipingConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        createErrorResponse("Invalid configuration", {
          errors: parsed.error.format(),
        }),
        { status: 400 }
      );
    }

    const configManager = ConfigurationManager.getInstance();
    const currentTrading = configManager.getSection("trading");
    const updatedTrading = {
      ...currentTrading,
      autoSniping: { ...currentTrading.autoSniping, ...parsed.data },
    };

    configManager.updateConfig({ trading: updatedTrading });

    return NextResponse.json(
      createSuccessResponse({
        config: configManager.getSection("trading").autoSniping,
        message: "Configuration updated successfully",
      })
    );
  } catch (error) {
    return NextResponse.json(
      createErrorResponse("Failed to update configuration", {
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500 }
    );
  }
}