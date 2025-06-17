import { NextRequest, NextResponse } from "next/server";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { db } from "@/src/db";
import { AlertConfigurationService } from "@/src/lib/alert-configuration";
import { validateRequest } from "@/src/lib/api-auth";
import { handleApiError } from "@/src/lib/api-response";

const alertConfigService = new AlertConfigurationService(db);

// ==========================================
// GET /api/alerts/rules/[id] - Get specific alert rule
// ==========================================
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const rule = await alertConfigService.getAlertRule(id);
    
    if (!rule) {
      return NextResponse.json({
        success: false,
        error: "Alert rule not found",
      }, { status: 404 });
    }

    // Parse JSON fields for client consumption
    const formattedRule = {
      ...rule,
      tags: rule.tags ? JSON.parse(rule.tags) : [],
      customFields: rule.customFields ? JSON.parse(rule.customFields) : {},
    };

    return NextResponse.json({
      success: true,
      data: formattedRule,
    });
  } catch (error) {
    console.error("Error fetching alert rule:", error);
    return handleApiError(error);
  }
}

// ==========================================
// PUT /api/alerts/rules/[id] - Update alert rule
// ==========================================
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    const body = await request.json();

    // Check if rule exists
    const existingRule = await alertConfigService.getAlertRule(id);
    if (!existingRule) {
      return NextResponse.json({
        success: false,
        error: "Alert rule not found",
      }, { status: 404 });
    }

    // Validate the configuration
    const validation = await alertConfigService.validateRuleConfiguration({
      ...existingRule,
      ...body,
    });
    
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: "Invalid rule configuration",
        details: validation.errors,
        warnings: validation.warnings,
      }, { status: 400 });
    }

    await alertConfigService.updateAlertRule(id, body);

    return NextResponse.json({
      success: true,
      warnings: validation.warnings,
      message: "Alert rule updated successfully",
    });
  } catch (error) {
    console.error("Error updating alert rule:", error);
    return handleApiError(error);
  }
}

// ==========================================
// DELETE /api/alerts/rules/[id] - Delete alert rule
// ==========================================
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await validateRequest(request);
    // validateRequest already throws if not authenticated, so if we reach here, user is authenticated

    // Check if rule exists
    const existingRule = await alertConfigService.getAlertRule(id);
    if (!existingRule) {
      return NextResponse.json({
        success: false,
        error: "Alert rule not found",
      }, { status: 404 });
    }

    await alertConfigService.deleteAlertRule(id);

    return NextResponse.json({
      success: true,
      message: "Alert rule disabled successfully",
    });
  } catch (error) {
    console.error("Error deleting alert rule:", error);
    return handleApiError(error);
  }
}