import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/src/inngest/client";
import { TradingStrategyRequestSchema } from "@/src/schemas/comprehensive-api-validation-schemas";
import { validateRequestBody } from "@/src/lib/api-validation-middleware";

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const bodyValidation = await validateRequestBody(request, TradingStrategyRequestSchema);
    if (!bodyValidation.success) {
      console.warn('[API] ⚠️ Trading strategy validation failed:', bodyValidation.error);
      return NextResponse.json(
        {
          success: false,
          error: bodyValidation.error,
        },
        { status: bodyValidation.statusCode }
      );
    }

    const { symbol, analysisData, riskParameters } = bodyValidation.data;

    // Trigger the trading strategy creation workflow
    const event = await inngest.send({
      name: "mexc/strategy.create",
      data: {
        symbol,
        analysisData,
        riskParameters,
        triggeredBy: "ui",
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Trading strategy workflow triggered for ${symbol}`,
      eventId: event.ids[0],
      symbol,
      riskParameters,
    });
  } catch (error) {
    console.error("Failed to trigger trading strategy:", { error: error });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger trading strategy workflow",
      },
      { status: 500 }
    );
  }
}