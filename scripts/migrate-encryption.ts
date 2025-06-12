#!/usr/bin/env node

/**
 * Migration script to re-encrypt existing API credentials
 * with the new secure encryption service
 * 
 * WARNING: This script should be run only once during migration
 * Make sure to backup your database before running!
 */

import { db, apiCredentials } from '../src/db';
import { createDecipheriv, createCipheriv, randomBytes } from 'crypto';
import { getEncryptionService } from '../src/services/secure-encryption-service';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

// Old encryption functions (for decryption only)
const OLD_ENCRYPTION_KEY = process.env.OLD_ENCRYPTION_KEY || 'default-key-change-in-production-32ch';
const OLD_ALGORITHM = 'aes-256-cbc';

function getOldKey(): Buffer {
  const key = OLD_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32);
  return Buffer.from(key, 'utf8');
}

function decryptOldString(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = createDecipheriv(OLD_ALGORITHM, getOldKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[Migration] Failed to decrypt with old method:', error);
    throw error;
  }
}

async function migrateEncryption() {
  console.log('🔄 Starting encryption migration...\n');

  // Check if new encryption key is set
  if (!process.env.ENCRYPTION_MASTER_KEY) {
    console.error('❌ ENCRYPTION_MASTER_KEY not found in environment!');
    console.error('   Generate a key using: openssl rand -base64 32');
    console.error('   Add it to .env.local as: ENCRYPTION_MASTER_KEY="your-key"');
    process.exit(1);
  }

  try {
    // Get the new encryption service
    const encryptionService = getEncryptionService();
    console.log('✅ New encryption service initialized\n');

    // Fetch all credentials
    const allCredentials = await db.select().from(apiCredentials);
    console.log(`📊 Found ${allCredentials.length} credential records to migrate\n`);

    if (allCredentials.length === 0) {
      console.log('✨ No credentials to migrate. Database is clean.\n');
      return;
    }

    let successCount = 0;
    let failureCount = 0;
    const failures: Array<{ id: number; userId: string; error: string }> = [];

    // Process each credential
    for (const cred of allCredentials) {
      try {
        console.log(`Processing credential ID ${cred.id} for user ${cred.userId}...`);

        // Check if already migrated (new format validation)
        if (encryptionService.isValidEncryptedFormat(cred.encryptedApiKey)) {
          console.log(`  ⏭️  Already migrated, skipping...`);
          successCount++;
          continue;
        }

        // Decrypt with old method
        const apiKey = decryptOldString(cred.encryptedApiKey);
        const secretKey = decryptOldString(cred.encryptedSecretKey);
        const passphrase = cred.encryptedPassphrase 
          ? decryptOldString(cred.encryptedPassphrase) 
          : null;

        // Validate decrypted data
        if (!apiKey || !secretKey) {
          throw new Error('Decrypted data is empty');
        }

        // Re-encrypt with new method
        const newEncryptedApiKey = encryptionService.encrypt(apiKey);
        const newEncryptedSecretKey = encryptionService.encrypt(secretKey);
        const newEncryptedPassphrase = passphrase 
          ? encryptionService.encrypt(passphrase) 
          : null;

        // Update database
        await db
          .update(apiCredentials)
          .set({
            encryptedApiKey: newEncryptedApiKey,
            encryptedSecretKey: newEncryptedSecretKey,
            encryptedPassphrase: newEncryptedPassphrase,
            updatedAt: new Date(),
          })
          .where(db.sql`id = ${cred.id}`);

        console.log(`  ✅ Successfully migrated\n`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed to migrate: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
        failureCount++;
        failures.push({
          id: cred.id,
          userId: cred.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Summary
    console.log('\n🏁 Migration Summary:');
    console.log(`   ✅ Successfully migrated: ${successCount}`);
    console.log(`   ❌ Failed migrations: ${failureCount}`);

    if (failures.length > 0) {
      console.log('\n❌ Failed records:');
      failures.forEach(f => {
        console.log(`   - ID: ${f.id}, User: ${f.userId}, Error: ${f.error}`);
      });
    }

    if (failureCount === 0) {
      console.log('\n🎉 All credentials successfully migrated!');
      console.log('🗑️  You can now remove the OLD_ENCRYPTION_KEY from your environment.');
    } else {
      console.log('\n⚠️  Some credentials failed to migrate. Please review the errors above.');
      console.log('   Failed credentials will need manual intervention.');
    }

  } catch (error) {
    console.error('\n💥 Fatal error during migration:', error);
    process.exit(1);
  } finally {
    // Close database connection
    process.exit(0);
  }
}

// Confirmation prompt
console.log('⚠️  ENCRYPTION MIGRATION WARNING ⚠️');
console.log('This script will re-encrypt all API credentials in the database.');
console.log('Make sure you have:');
console.log('1. Backed up your database');
console.log('2. Set ENCRYPTION_MASTER_KEY in .env.local');
console.log('3. Set OLD_ENCRYPTION_KEY if different from default\n');

if (process.argv.includes('--force')) {
  migrateEncryption();
} else {
  console.log('Run with --force flag to proceed:');
  console.log('  bun run scripts/migrate-encryption.ts --force\n');
}