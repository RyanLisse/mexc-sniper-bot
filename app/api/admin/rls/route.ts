import { NextRequest, NextResponse } from "next/server";
import { apiResponse } from "@/src/lib/api-response";
import { requireAuth } from "@/src/lib/supabase-auth";
import { 
  checkRLSStatus, 
  applyRLSMigration, 
  testRLSPolicies,
  createRLSHelperFunctions,
  validateRLSSetup
} from "@/src/lib/supabase-rls";

/**
 * RLS Management API
 * 
 * GET /api/admin/rls - Check RLS status
 * POST /api/admin/rls - Apply RLS migration or run tests
 */

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth();
    if (!user) {
      return apiResponse.unauthorized("Authentication required");
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "status";

    switch (action) {
      case "status":
        const rlsStatus = await checkRLSStatus();
        return apiResponse.success({
          rlsStatus,
          timestamp: new Date().toISOString(),
        });

      case "validate":
        const validation = await validateRLSSetup();
        return apiResponse.success({
          validation,
          timestamp: new Date().toISOString(),
        });

      default:
        return apiResponse.badRequest(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error("[RLS API] GET Error:", error);
    return apiResponse.error(
      "Failed to check RLS status",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth();
    if (!user) {
      return apiResponse.unauthorized("Authentication required");
    }

    // For security, only allow specific admin users or in development
    const isAdmin = user.email?.includes('admin') || 
                   process.env.NODE_ENV === 'development';
    
    if (!isAdmin) {
      return apiResponse.error("Admin access required for RLS management", 403);
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "apply_migration":
        console.log("[RLS API] Applying RLS migration...");
        
        // First create helper functions
        const helperResult = await createRLSHelperFunctions();
        if (!helperResult.success) {
          return apiResponse.error(
            "Failed to create RLS helper functions",
            500,
            { errors: helperResult.errors }
          );
        }

        // Then apply the migration
        const migrationResult = await applyRLSMigration();
        
        if (migrationResult.success) {
          return apiResponse.success({
            message: "RLS migration applied successfully",
            timestamp: new Date().toISOString(),
          });
        } else {
          return apiResponse.error(
            "RLS migration failed",
            500,
            { errors: migrationResult.errors }
          );
        }

      case "test_policies":
        const userId = user.id;
        if (!userId) {
          return apiResponse.badRequest("User ID required for testing");
        }

        console.log("[RLS API] Testing RLS policies for user:", userId);
        
        const testResult = await testRLSPolicies(userId);
        
        return apiResponse.success({
          testResult,
          userId,
          timestamp: new Date().toISOString(),
        });

      case "create_helpers":
        console.log("[RLS API] Creating RLS helper functions...");
        
        const helpersResult = await createRLSHelperFunctions();
        
        if (helpersResult.success) {
          return apiResponse.success({
            message: "RLS helper functions created successfully",
            timestamp: new Date().toISOString(),
          });
        } else {
          return apiResponse.error(
            "Failed to create helper functions",
            500,
            { errors: helpersResult.errors }
          );
        }

      case "full_setup":
        console.log("[RLS API] Running full RLS setup...");
        
        // Step 1: Create helper functions
        const step1 = await createRLSHelperFunctions();
        if (!step1.success) {
          return apiResponse.error(
            "Failed at step 1: Creating helper functions",
            500,
            { errors: step1.errors }
          );
        }

        // Step 2: Apply migration
        const step2 = await applyRLSMigration();
        if (!step2.success) {
          return apiResponse.error(
            "Failed at step 2: Applying RLS migration",
            500,
            { errors: step2.errors }
          );
        }

        // Step 3: Validate setup
        const step3 = await validateRLSSetup();
        
        // Step 4: Test policies (if validation passed)
        let step4 = null;
        if (step3.valid && user.id) {
          step4 = await testRLSPolicies(user.id);
        }

        return apiResponse.success({
          message: "Full RLS setup completed",
          steps: {
            helpers: step1,
            migration: step2,
            validation: step3,
            testing: step4,
          },
          timestamp: new Date().toISOString(),
        });

      default:
        return apiResponse.badRequest(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error("[RLS API] POST Error:", error);
    return apiResponse.error(
      "Failed to execute RLS operation",
      500
    );
  }
}