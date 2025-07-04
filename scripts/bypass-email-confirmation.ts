#!/usr/bin/env bun
/**
 * Email Confirmation Bypass Utility
 * 
 * This script helps bypass email confirmation for testing purposes by:
 * 1. Confirming existing unconfirmed users
 * 2. Creating test users with email confirmation pre-bypassed
 * 3. Checking current email confirmation status
 */

import { createSupabaseAdminClient } from '@/src/lib/supabase-auth';

interface BypassOptions {
  email?: string;
  confirmAll?: boolean;
  createTestUser?: boolean;
  checkStatus?: boolean;
}

class EmailConfirmationBypass {
  private supabase = createSupabaseAdminClient();

  async checkEmailConfirmationStatus(email?: string) {
    try {
      const { data: users, error } = await this.supabase.auth.admin.listUsers();
      
      if (error) {
        console.error('Error listing users:', error);
        return;
      }

      const usersToCheck = email 
        ? users.users.filter(u => u.email === email)
        : users.users;

      console.log('\n📊 Email Confirmation Status:');
      console.log('=' .repeat(50));
      
      if (usersToCheck.length === 0) {
        console.log(`❌ No users found${email ? ` with email: ${email}` : ''}`);
        return;
      }

      usersToCheck.forEach(user => {
        const isConfirmed = !!user.email_confirmed_at;
        const status = isConfirmed ? '✅ Confirmed' : '❌ Not Confirmed';
        console.log(`${status} | ${user.email} | ID: ${user.id}`);
      });

      const unconfirmedCount = usersToCheck.filter(u => !u.email_confirmed_at).length;
      console.log(`\n📈 Summary: ${unconfirmedCount} unconfirmed users`);

    } catch (error) {
      console.error('Error checking email confirmation status:', error);
    }
  }

  async bypassEmailConfirmation(email: string) {
    try {
      console.log(`🔄 Bypassing email confirmation for: ${email}`);
      
      // Find the user by email
      const { data: users, error: listError } = await this.supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
        return false;
      }

      const user = users.users.find(u => u.email === email);
      
      if (!user) {
        console.error(`❌ User not found with email: ${email}`);
        return false;
      }

      if (user.email_confirmed_at) {
        console.log(`✅ User ${email} is already confirmed`);
        return true;
      }

      // Update user to confirm email
      const { error: updateError } = await this.supabase.auth.admin.updateUserById(
        user.id,
        {
          email_confirm: true,
        }
      );

      if (updateError) {
        console.error('Error confirming email:', updateError);
        return false;
      }

      console.log(`✅ Successfully bypassed email confirmation for: ${email}`);
      return true;

    } catch (error) {
      console.error('Error bypassing email confirmation:', error);
      return false;
    }
  }

  async bypassAllUnconfirmedUsers() {
    try {
      console.log('🔄 Bypassing email confirmation for all unconfirmed users...');
      
      const { data: users, error } = await this.supabase.auth.admin.listUsers();
      
      if (error) {
        console.error('Error listing users:', error);
        return;
      }

      const unconfirmedUsers = users.users.filter(u => !u.email_confirmed_at);
      
      if (unconfirmedUsers.length === 0) {
        console.log('✅ No unconfirmed users found');
        return;
      }

      console.log(`Found ${unconfirmedUsers.length} unconfirmed users`);
      
      for (const user of unconfirmedUsers) {
        const success = await this.bypassEmailConfirmation(user.email!);
        if (success) {
          console.log(`  ✅ Confirmed: ${user.email}`);
        } else {
          console.log(`  ❌ Failed: ${user.email}`);
        }
      }

    } catch (error) {
      console.error('Error bypassing all email confirmations:', error);
    }
  }

  async createTestUserWithBypass(email: string, password: string = 'Testing2025!') {
    try {
      console.log(`🔄 Creating test user with email confirmation bypass: ${email}`);
      
      const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Skip email confirmation
      });

      if (authError) {
        console.error('Error creating test user:', authError);
        return false;
      }

      console.log(`✅ Successfully created test user: ${email}`);
      console.log(`   User ID: ${authData.user?.id}`);
      console.log(`   Email Confirmed: ${!!authData.user?.email_confirmed_at}`);
      
      return true;

    } catch (error) {
      console.error('Error creating test user:', error);
      return false;
    }
  }

  async validateSupabaseConnection() {
    try {
      console.log('🔄 Validating Supabase connection...');
      
      const { data, error } = await this.supabase.auth.admin.listUsers();
      
      if (error) {
        console.error('❌ Supabase connection failed:', error);
        return false;
      }

      console.log(`✅ Supabase connection successful. Found ${data.users.length} users.`);
      return true;

    } catch (error) {
      console.error('❌ Supabase connection error:', error);
      return false;
    }
  }
}

// CLI interface
async function main() {
  const bypass = new EmailConfirmationBypass();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: BypassOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--email':
        options.email = args[i + 1];
        i++;
        break;
      case '--confirm-all':
        options.confirmAll = true;
        break;
      case '--create-test-user':
        options.createTestUser = true;
        break;
      case '--check-status':
        options.checkStatus = true;
        break;
      case '--help':
        console.log(`
📧 Email Confirmation Bypass Utility

Usage:
  bun run scripts/bypass-email-confirmation.ts [options]

Options:
  --email <email>          Bypass confirmation for specific email
  --confirm-all           Bypass confirmation for all unconfirmed users
  --create-test-user      Create test user with bypassed confirmation
  --check-status          Check email confirmation status
  --help                  Show this help message

Examples:
  # Check status of all users
  bun run scripts/bypass-email-confirmation.ts --check-status

  # Bypass confirmation for specific user
  bun run scripts/bypass-email-confirmation.ts --email user@example.com

  # Bypass confirmation for all unconfirmed users
  bun run scripts/bypass-email-confirmation.ts --confirm-all

  # Create test user with bypassed confirmation
  bun run scripts/bypass-email-confirmation.ts --create-test-user --email test@example.com
        `);
        return;
    }
  }

  // Validate Supabase connection first
  const isConnected = await bypass.validateSupabaseConnection();
  if (!isConnected) {
    console.error('❌ Cannot proceed without valid Supabase connection');
    process.exit(1);
  }

  // Execute based on options
  if (options.checkStatus) {
    await bypass.checkEmailConfirmationStatus(options.email);
  } else if (options.confirmAll) {
    await bypass.bypassAllUnconfirmedUsers();
  } else if (options.createTestUser && options.email) {
    await bypass.createTestUserWithBypass(options.email);
  } else if (options.email) {
    await bypass.bypassEmailConfirmation(options.email);
  } else {
    console.log('❓ No action specified. Use --help for usage information.');
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

export { EmailConfirmationBypass };