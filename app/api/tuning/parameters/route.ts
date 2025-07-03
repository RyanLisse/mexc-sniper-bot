/**
 * Parameter Management API Routes
 *
 * API endpoints for managing system parameters, snapshots, and validation
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getParameterManager } from "@/src/lib/parameter-management";
import { logger } from "@/src/lib/utils";

// Validation schemas
const ParameterUpdateSchema = z.object({
  parameters: z.record(z.string(), z.any()),
  source: z.string().optional(),
  reason: z.string().optional(),
});

const SnapshotSchema = z.object({
  name: z.string().min(1),
  reason: z.string().optional(),
});

/**
 * GET /api/tuning/parameters
 * Get all current parameters or specific category
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const includeDefinitions =
      searchParams.get("includeDefinitions") === "true";
    const includeHistory = searchParams.get("includeHistory") === "true";

    const parameterManager = getParameterManager();
    let parameters;
    if (category) {
      parameters = parameterManager.getParametersByCategory(category);
    } else {
      parameters = parameterManager.getCurrentParameters();
    }

    const response: any = { parameters };

    if (includeDefinitions) {
      const definitions = Object.fromEntries(
        parameterManager.getParameterDefinitions()
      );
      response.definitions = definitions;
    }

    if (includeHistory) {
      response.changeHistory = parameterManager.getChangeHistory().slice(0, 50); // Last 50 changes
    }

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Failed to get parameters:", { error });
    return NextResponse.json(
      { error: "Failed to retrieve parameters" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tuning/parameters
 * Update parameters
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = ParameterUpdateSchema.parse(body);

    const parameterManager = getParameterManager();
    // Validate parameters before updating
    const validation = await parameterManager.validateParameters(
      validatedData.parameters
    );

    if (!validation.passed) {
      return NextResponse.json(
        {
          error: "Parameter validation failed",
          violations: validation.violations,
          warnings: validation.warnings,
          riskLevel: validation.riskLevel,
        },
        { status: 400 }
      );
    }

    // Update parameters
    await parameterManager.updateParameters(validatedData.parameters, {
      source: validatedData.source || "api",
      reason: validatedData.reason,
      timestamp: new Date(),
    });

    logger.info("Parameters updated via API", {
      parameterCount: Object.keys(validatedData.parameters).length,
      source: validatedData.source,
    });

    return NextResponse.json({
      message: "Parameters updated successfully",
      updatedCount: Object.keys(validatedData.parameters).length,
      warnings: validation.warnings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    logger.error("Failed to update parameters:", { error });
    return NextResponse.json(
      { error: "Failed to update parameters" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tuning/parameters
 * Parameter management actions (validate, reset, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const parameterManager = getParameterManager();
    switch (action) {
      case "validate": {
        const { parameters } = body;
        if (!parameters) {
          return NextResponse.json(
            { error: "Parameters are required for validation" },
            { status: 400 }
          );
        }

        const validation =
          await parameterManager.validateParameters(parameters);
        return NextResponse.json(validation);
      }

      case "reset_all": {
        await parameterManager.resetAllParameters();
        logger.info("All parameters reset to defaults via API");

        return NextResponse.json({
          message: "All parameters reset to default values",
        });
      }

      case "reset_parameter": {
        const { parameterName } = body;
        if (!parameterName) {
          return NextResponse.json(
            { error: "Parameter name is required" },
            { status: 400 }
          );
        }

        await parameterManager.resetParameter(parameterName);
        logger.info("Parameter reset via API", { parameterName });

        return NextResponse.json({
          message: `Parameter '${parameterName}' reset to default value`,
        });
      }

      case "create_snapshot": {
        const validatedSnapshot = SnapshotSchema.parse(body);
        const snapshotId = await parameterManager.createSnapshot(
          validatedSnapshot.name,
          validatedSnapshot.reason
        );

        return NextResponse.json({
          message: "Snapshot created successfully",
          snapshotId,
        });
      }

      case "restore_snapshot": {
        const { snapshotId } = body;
        if (!snapshotId) {
          return NextResponse.json(
            { error: "Snapshot ID is required" },
            { status: 400 }
          );
        }

        await parameterManager.restoreFromSnapshot(snapshotId);
        logger.info("Parameters restored from snapshot via API", {
          snapshotId,
        });

        return NextResponse.json({
          message: "Parameters restored from snapshot successfully",
        });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }

    logger.error("Failed to execute parameter action:", { error });
    return NextResponse.json(
      { error: "Failed to execute parameter action" },
      { status: 500 }
    );
  }
}
