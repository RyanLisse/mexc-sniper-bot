/**
 * Safety Constraints API Routes
 *
 * API endpoints for managing safety constraints and risk parameters
 */

import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/src/lib/utils";

/**
 * GET /api/tuning/safety-constraints
 * Get all safety constraints and their current status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category"); // Filter by category
    const status = searchParams.get("status"); // Filter by status
    const severity = searchParams.get("severity"); // Filter by severity
    const includeDisabled = searchParams.get("includeDisabled") === "true";

    // Generate realistic safety constraints data
    const constraints = generateSafetyConstraints(
      category,
      status,
      severity,
      includeDisabled
    );

    return NextResponse.json({
      constraints,
      total: constraints.length,
      summary: {
        active: constraints.filter((c) => c.enabled).length,
        violations: constraints.filter((c) => c.currentStatus === "violation")
          .length,
        warnings: constraints.filter((c) => c.currentStatus === "warning")
          .length,
        critical: constraints.filter((c) => c.severity === "critical").length,
      },
      filters: {
        category,
        status,
        severity,
        includeDisabled,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to get safety constraints:", { error });
    return NextResponse.json(
      { error: "Failed to retrieve safety constraints" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tuning/safety-constraints
 * Create a new safety constraint
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, type, category, severity, value, validation } =
      body;

    // Validate required fields
    if (
      !name ||
      !description ||
      !type ||
      !category ||
      !severity ||
      value === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate new constraint ID
    const constraintId = `constraint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create new safety constraint (in real implementation, this would be saved to database)
    const newConstraint = {
      id: constraintId,
      name,
      description,
      type,
      category,
      severity,
      enabled: true,
      locked: false,
      value,
      defaultValue: value,
      validation: validation || {},
      currentStatus: "ok" as const,
      lastChecked: new Date().toISOString(),
      violationCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    logger.info("Safety constraint created", { constraintId, name });

    return NextResponse.json({
      message: "Safety constraint created successfully",
      constraint: newConstraint,
    });
  } catch (error) {
    logger.error("Failed to create safety constraint:", { error });
    return NextResponse.json(
      { error: "Failed to create safety constraint" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tuning/safety-constraints
 * Update an existing safety constraint
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return NextResponse.json(
        { error: "Missing constraint ID or updates" },
        { status: 400 }
      );
    }

    // In real implementation, this would update the constraint in database
    logger.info("Safety constraint updated", { id, updates });

    return NextResponse.json({
      message: "Safety constraint updated successfully",
      id,
      updates,
    });
  } catch (error) {
    logger.error("Failed to update safety constraint:", { error });
    return NextResponse.json(
      { error: "Failed to update safety constraint" },
      { status: 500 }
    );
  }
}

/**
 * Generate realistic safety constraints data
 */
function generateSafetyConstraints(
  categoryFilter: string | null,
  statusFilter: string | null,
  severityFilter: string | null,
  includeDisabled: boolean
) {
  const now = new Date();

  const constraints = [
    {
      id: "max-position-size",
      name: "Maximum Position Size",
      description:
        "Limit maximum position size to prevent overexposure and maintain portfolio diversification",
      type: "threshold" as const,
      category: "risk" as const,
      severity: "critical" as const,
      enabled: true,
      locked: true,
      value: 0.05, // 5% of portfolio
      defaultValue: 0.03,
      validation: { min: 0.01, max: 0.1 },
      currentStatus: "ok" as const,
      lastChecked: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      violationCount: 0,
      metadata: {
        lastViolation: null,
        averageValue: 0.034,
        peakValue: 0.047,
        enforcementActions: 12,
      },
    },

    {
      id: "max-daily-trades",
      name: "Maximum Daily Trades",
      description:
        "Limit number of trades per day to prevent overtrading and preserve capital",
      type: "threshold" as const,
      category: "risk" as const,
      severity: "high" as const,
      enabled: true,
      locked: false,
      value: 50,
      defaultValue: 30,
      validation: { min: 10, max: 100 },
      currentStatus: "warning" as const,
      lastChecked: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
      violationCount: 3,
      metadata: {
        lastViolation: new Date(
          now.getTime() - 6 * 60 * 60 * 1000
        ).toISOString(), // 6 hours ago
        currentDailyTrades: 42,
        averageDailyTrades: 28,
        peakDailyTrades: 47,
      },
    },

    {
      id: "max-drawdown-limit",
      name: "Maximum Drawdown Limit",
      description:
        "Stop trading when portfolio drawdown exceeds acceptable threshold",
      type: "threshold" as const,
      category: "risk" as const,
      severity: "critical" as const,
      enabled: true,
      locked: true,
      value: 0.15, // 15% maximum drawdown
      defaultValue: 0.1,
      validation: { min: 0.05, max: 0.25 },
      currentStatus: "ok" as const,
      lastChecked: new Date(now.getTime() - 1 * 60 * 1000).toISOString(), // 1 minute ago
      violationCount: 0,
      metadata: {
        currentDrawdown: 0.067,
        maxHistoricalDrawdown: 0.123,
        averageDrawdown: 0.045,
        recoveryTime: "2.3 days",
      },
    },

    {
      id: "min-liquidity-requirement",
      name: "Minimum Liquidity Requirement",
      description:
        "Ensure sufficient liquidity before entering positions to avoid slippage",
      type: "threshold" as const,
      category: "performance" as const,
      severity: "medium" as const,
      enabled: true,
      locked: false,
      value: 100000, // $100k minimum volume
      defaultValue: 50000,
      validation: { min: 10000, max: 1000000 },
      currentStatus: "ok" as const,
      lastChecked: new Date(now.getTime() - 30 * 1000).toISOString(), // 30 seconds ago
      violationCount: 1,
      metadata: {
        averageLiquidity: 245000,
        minimumObserved: 87000,
        lastLowLiquidityEvent: new Date(
          now.getTime() - 12 * 60 * 60 * 1000
        ).toISOString(),
      },
    },

    {
      id: "pattern-confidence-threshold",
      name: "Pattern Confidence Threshold",
      description:
        "Minimum confidence level required for pattern-based trading signals",
      type: "threshold" as const,
      category: "performance" as const,
      severity: "medium" as const,
      enabled: true,
      locked: false,
      value: 0.75, // 75% confidence
      defaultValue: 0.7,
      validation: { min: 0.5, max: 0.95 },
      currentStatus: "ok" as const,
      lastChecked: new Date(now.getTime() - 45 * 1000).toISOString(), // 45 seconds ago
      violationCount: 0,
      metadata: {
        averageConfidence: 0.83,
        minimumConfidence: 0.61,
        patternsRejected: 23,
        patternsAccepted: 156,
      },
    },

    {
      id: "system-latency-limit",
      name: "System Latency Limit",
      description:
        "Maximum acceptable system response time for trade execution",
      type: "threshold" as const,
      category: "system" as const,
      severity: "high" as const,
      enabled: true,
      locked: false,
      value: 500, // 500ms maximum latency
      defaultValue: 300,
      validation: { min: 100, max: 2000 },
      currentStatus: "violation" as const,
      lastChecked: new Date(now.getTime() - 10 * 1000).toISOString(), // 10 seconds ago
      violationCount: 7,
      metadata: {
        currentLatency: 587,
        averageLatency: 245,
        peakLatency: 1200,
        lastViolation: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
      },
    },

    {
      id: "api-rate-limit-buffer",
      name: "API Rate Limit Buffer",
      description:
        "Maintain buffer below exchange API rate limits to prevent throttling",
      type: "threshold" as const,
      category: "system" as const,
      severity: "medium" as const,
      enabled: true,
      locked: false,
      value: 0.8, // Use max 80% of rate limit
      defaultValue: 0.75,
      validation: { min: 0.5, max: 0.95 },
      currentStatus: "ok" as const,
      lastChecked: new Date(now.getTime() - 15 * 1000).toISOString(), // 15 seconds ago
      violationCount: 2,
      metadata: {
        currentUsage: 0.67,
        peakUsage: 0.89,
        rateLimitHits: 2,
        lastThrottling: new Date(
          now.getTime() - 3 * 60 * 60 * 1000
        ).toISOString(),
      },
    },

    {
      id: "emergency-stop-trigger",
      name: "Emergency Stop Trigger",
      description:
        "Automatic emergency stop when multiple violations occur simultaneously",
      type: "boolean" as const,
      category: "risk" as const,
      severity: "critical" as const,
      enabled: true,
      locked: true,
      value: true,
      defaultValue: true,
      validation: {},
      currentStatus: "ok" as const,
      lastChecked: new Date(now.getTime() - 1 * 60 * 1000).toISOString(), // 1 minute ago
      violationCount: 0,
      metadata: {
        triggerCount: 1,
        lastTrigger: new Date(
          now.getTime() - 48 * 60 * 60 * 1000
        ).toISOString(), // 2 days ago
        autoRecoveryEnabled: true,
        manualOverrideRequired: false,
      },
    },

    {
      id: "balance-protection",
      name: "Account Balance Protection",
      description:
        "Prevent trading when account balance falls below minimum threshold",
      type: "threshold" as const,
      category: "risk" as const,
      severity: "critical" as const,
      enabled: false, // Disabled for demo
      locked: false,
      value: 1000, // $1000 minimum balance
      defaultValue: 500,
      validation: { min: 100, max: 10000 },
      currentStatus: "ok" as const,
      lastChecked: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      violationCount: 0,
      metadata: {
        currentBalance: 5420,
        minimumObserved: 892,
        balanceAlerts: 0,
        autoTopUpEnabled: false,
      },
    },
  ];

  // Apply filters
  let filteredConstraints = constraints;

  if (categoryFilter) {
    filteredConstraints = filteredConstraints.filter(
      (c) => c.category === categoryFilter
    );
  }

  if (statusFilter) {
    filteredConstraints = filteredConstraints.filter(
      (c) => c.currentStatus === statusFilter
    );
  }

  if (severityFilter) {
    filteredConstraints = filteredConstraints.filter(
      (c) => c.severity === severityFilter
    );
  }

  if (!includeDisabled) {
    filteredConstraints = filteredConstraints.filter((c) => c.enabled);
  }

  return filteredConstraints;
}
