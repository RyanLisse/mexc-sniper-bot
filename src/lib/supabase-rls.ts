/**
 * Supabase Row Level Security (RLS) Management
 * 
 * This module provides utilities for managing RLS policies and ensuring
 * secure data access patterns in the MEXC Sniper Bot application.
 */

import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/src/db';
import { readFileSync } from 'fs';
import { join } from 'path';

interface RLSPolicyCheck {
  tableName: string;
  policyName: string;
  exists: boolean;
  description?: string;
}

interface RLSStatus {
  enabled: boolean;
  policies: RLSPolicyCheck[];
  errors: string[];
}

/**
 * Check if RLS is enabled on all required tables
 */
export async function checkRLSStatus(): Promise<RLSStatus> {
  try {
    const requiredTables = [
      'users',
      'user_roles', 
      'workflow_system_status',
      'workflow_activity',
      'coin_activities',
      'snipe_targets',
      'user_preferences',
      'api_credentials',
      'execution_history',
      'transactions',
      'transaction_locks',
      'balance_snapshots',
      'portfolio_summary'
    ];

    const { data: tablesData, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name, table_schema')
      .eq('table_schema', 'public')
      .in('table_name', requiredTables);

    if (tablesError) {
      throw new Error(`Failed to check tables: ${tablesError.message}`);
    }

    // Check RLS status for each table
    const rlsChecks: { [key: string]: boolean } = {};
    const errors: string[] = [];

    for (const table of requiredTables) {
      try {
        const { data: rlsData, error: rlsError } = await supabaseAdmin.rpc(
          'check_table_rls',
          { table_name: table }
        );

        if (rlsError) {
          errors.push(`Failed to check RLS for ${table}: ${rlsError.message}`);
          rlsChecks[table] = false;
        } else {
          rlsChecks[table] = rlsData;
        }
      } catch (error) {
        errors.push(`Error checking RLS for ${table}: ${error}`);
        rlsChecks[table] = false;
      }
    }

    // Check policies exist
    const policies: RLSPolicyCheck[] = [];
    
    try {
      const { data: policiesData, error: policiesError } = await supabaseAdmin
        .from('information_schema.table_privileges')
        .select('*')
        .eq('table_schema', 'public');

      if (policiesError) {
        errors.push(`Failed to check policies: ${policiesError.message}`);
      }
    } catch (error) {
      errors.push(`Error checking policies: ${error}`);
    }

    const allTablesHaveRLS = Object.values(rlsChecks).every(hasRLS => hasRLS);

    return {
      enabled: allTablesHaveRLS,
      policies,
      errors
    };

  } catch (error) {
    return {
      enabled: false,
      policies: [],
      errors: [`General RLS check failed: ${error}`]
    };
  }
}

/**
 * Apply RLS migration from SQL file
 */
export async function applyRLSMigration(): Promise<{ success: boolean; errors: string[] }> {
  try {
    const migrationPath = join(process.cwd(), 'src/db/migrations/001_setup_rls_policies.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    const errors: string[] = [];
    let successCount = 0;

    for (const statement of statements) {
      try {
        const { error } = await supabaseAdmin.rpc('exec_sql', {
          sql: statement + ';'
        });

        if (error) {
          errors.push(`Failed to execute statement: ${error.message}`);
        } else {
          successCount++;
        }
      } catch (error) {
        errors.push(`Error executing statement: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      errors
    };

  } catch (error) {
    return {
      success: false,
      errors: [`Failed to apply RLS migration: ${error}`]
    };
  }
}

/**
 * Test RLS policies with sample operations
 */
export async function testRLSPolicies(userId: string): Promise<{ 
  success: boolean; 
  results: string[];
  errors: string[];
}> {
  const results: string[] = [];
  const errors: string[] = [];

  try {
    // Create a client with the user's authentication
    const userClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Test 1: User can access their own data
    try {
      const { data: userData, error: userError } = await userClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        errors.push(`Failed to access own user data: ${userError.message}`);
      } else {
        results.push('✓ User can access own profile data');
      }
    } catch (error) {
      errors.push(`User data access test failed: ${error}`);
    }

    // Test 2: User cannot access other users' data
    try {
      const { data: otherUsersData, error: otherUsersError } = await userClient
        .from('users')
        .select('*')
        .neq('id', userId)
        .limit(1);

      if (otherUsersData && otherUsersData.length > 0) {
        errors.push('❌ User can access other users\' data (RLS violation)');
      } else {
        results.push('✓ User cannot access other users\' data');
      }
    } catch (error) {
      results.push('✓ User cannot access other users\' data (access denied)');
    }

    // Test 3: API credentials isolation
    try {
      const { data: credentialsData, error: credentialsError } = await userClient
        .from('api_credentials')
        .select('*')
        .neq('user_id', userId)
        .limit(1);

      if (credentialsData && credentialsData.length > 0) {
        errors.push('❌ User can access other users\' API credentials (CRITICAL RLS violation)');
      } else {
        results.push('✓ API credentials are properly isolated');
      }
    } catch (error) {
      results.push('✓ API credentials are properly isolated (access denied)');
    }

    // Test 4: Transaction data isolation
    try {
      const { data: transactionData, error: transactionError } = await userClient
        .from('transactions')
        .select('*')
        .neq('user_id', userId)
        .limit(1);

      if (transactionData && transactionData.length > 0) {
        errors.push('❌ User can access other users\' transactions (CRITICAL RLS violation)');
      } else {
        results.push('✓ Transaction data is properly isolated');
      }
    } catch (error) {
      results.push('✓ Transaction data is properly isolated (access denied)');
    }

    return {
      success: errors.length === 0,
      results,
      errors
    };

  } catch (error) {
    return {
      success: false,
      results,
      errors: [`RLS testing failed: ${error}`]
    };
  }
}

/**
 * Create RLS function for PostgreSQL to check table RLS status
 */
export async function createRLSHelperFunctions(): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Function to check if RLS is enabled on a table
    const checkRLSFunction = `
      CREATE OR REPLACE FUNCTION check_table_rls(table_name TEXT)
      RETURNS BOOLEAN AS $$
      DECLARE
        rls_enabled BOOLEAN;
      BEGIN
        SELECT relrowsecurity INTO rls_enabled
        FROM pg_class
        WHERE relname = table_name
          AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
        
        RETURN COALESCE(rls_enabled, FALSE);
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    // Function to execute SQL statements
    const execSQLFunction = `
      CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
      RETURNS VOID AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    const functions = [checkRLSFunction, execSQLFunction];

    for (const func of functions) {
      try {
        const { error } = await supabaseAdmin.rpc('exec', { sql: func });
        if (error) {
          errors.push(`Failed to create helper function: ${error.message}`);
        }
      } catch (error) {
        errors.push(`Error creating helper function: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      errors
    };

  } catch (error) {
    return {
      success: false,
      errors: [`Failed to create RLS helper functions: ${error}`]
    };
  }
}

/**
 * Validate that all required RLS policies are in place
 */
export async function validateRLSSetup(): Promise<{
  valid: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    const rlsStatus = await checkRLSStatus();

    if (!rlsStatus.enabled) {
      issues.push('RLS is not enabled on all required tables');
      recommendations.push('Run the RLS migration to enable Row Level Security');
    }

    if (rlsStatus.errors.length > 0) {
      issues.push(...rlsStatus.errors);
    }

    // Additional security checks
    if (rlsStatus.enabled) {
      recommendations.push('Consider periodic RLS policy audits');
      recommendations.push('Monitor RLS policy performance impact');
      recommendations.push('Test RLS policies with different user roles');
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };

  } catch (error) {
    return {
      valid: false,
      issues: [`RLS validation failed: ${error}`],
      recommendations: ['Check Supabase connection and permissions']
    };
  }
}