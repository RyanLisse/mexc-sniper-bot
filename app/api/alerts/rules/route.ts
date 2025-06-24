import { NextRequest, NextResponse } from "next/server";
import { createSafeLogger } from '../../../../src/lib/structured-logger';
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { db } from "../../../../src/db";
import { AlertConfigurationService } from "../../../../src/lib/alert-configuration";
import { validateRequest } from "../../../../src/lib/api-auth";
import { handleApiError } from "../../../../src/lib/api-response";
import { z } from "zod";

const alertConfigService = new AlertConfigurationService(db);

// ==========================================
// GET /api/alerts/rules - List alert rules
// ==========================================
const logger = createSafeLogger('route');

export async function GET(request: NextRequest) {
  try {
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const severity = searchParams.get("severity") || undefined;
    const enabled = searchParams.get("enabled") !== null ? searchParams.get("enabled") === "true" : undefined;
    const metricName = searchParams.get("metricName") || undefined;

    const rules = await alertConfigService.listAlertRules({
      category,
      severity,
      enabled,
      metricName,
    });

    // Parse JSON fields for client consumption
    const formattedRules = rules.map(rule => ({
      ...rule,
      tags: rule.tags ? JSON.parse(rule.tags) : [],
      customFields: rule.customFields ? JSON.parse(rule.customFields) : {},
    }));

    return NextResponse.json({
      success: true,
      data: formattedRules,
      count: formattedRules.length,
    });
  } catch (error) {
    logger.error("Error fetching alert rules:", { error: error });
    return handleApiError(error);
  }
}

// ==========================================
// POST /api/alerts/rules - Create alert rule
// ==========================================
export async function POST(request: NextRequest) {
  try {
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const body = await request.json();
    
    // Validate the configuration
    const validation = await alertConfigService.validateRuleConfiguration(body);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: "Invalid rule configuration",
        details: validation.errors,
        warnings: validation.warnings,
      }, { status: 400 });
    }

    const ruleId = await alertConfigService.createAlertRule(body, user.id);

    return NextResponse.json({
      success: true,
      data: { ruleId },
      warnings: validation.warnings,
      message: "Alert rule created successfully",
    }, { status: 201 });
  } catch (error) {
    logger.error("Error creating alert rule:", { error: error });
    return handleApiError(error);
  }
}

// ==========================================
// DELETE /api/alerts/rules - Bulk delete rules
// ==========================================
export async function DELETE(request: NextRequest) {
  try {
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const body = await request.json();
    const { ruleIds } = z.object({
      ruleIds: z.array(z.string()),
    }).parse(body);

    for (const ruleId of ruleIds) {
      await alertConfigService.deleteAlertRule(ruleId);
    }

    return NextResponse.json({
      success: true,
      message: `${ruleIds.length} alert rules disabled successfully`,
    });
  } catch (error) {
    logger.error("Error deleting alert rules:", { error: error });
    return handleApiError(error);
  }
}