#!/usr/bin/env node

/**
 * GitHub Secrets Setup using REST API
 * Alternative method using the GitHub REST API directly
 */

import { Octokit } from '@octokit/rest';
import { createPublicKey, publicEncrypt } from 'crypto';
import { readFileSync } from 'fs';
import { createInterface } from 'readline';

// Configuration
const CONFIG = {
  owner: process.env.GITHUB_REPOSITORY_OWNER || '',
  repo: process.env.GITHUB_REPOSITORY_NAME || '',
  token: process.env.GITHUB_TOKEN || '',
};

// Secret definitions
const SECRETS = {
  // Vercel Deployment
  VERCEL_TOKEN: { description: 'Vercel CLI authentication token', required: true },
  VERCEL_ORG_ID: { description: 'Vercel organization/team ID', required: true },
  VERCEL_PROJECT_ID: { description: 'Vercel project ID', required: true },
  
  // Database & External Services
  DATABASE_URL: { description: 'NeonDB PostgreSQL connection string', required: true },
  MEXC_API_KEY: { description: 'MEXC Exchange API key', required: true },
  MEXC_SECRET_KEY: { description: 'MEXC Exchange secret key', required: true },
  OPENAI_API_KEY: { description: 'OpenAI API key', required: true },
  
  // Authentication & Security
  KINDE_CLIENT_ID: { description: 'Kinde authentication client ID', required: true },
  KINDE_CLIENT_SECRET: { description: 'Kinde authentication client secret', required: true },
  KINDE_ISSUER_URL: { description: 'Kinde issuer URL', required: true },
  NEXTAUTH_SECRET: { description: 'NextAuth.js session encryption secret', required: true },
  
  // Optional Monitoring
  CODECOV_TOKEN: { description: 'Codecov upload token', required: false },
  SLACK_WEBHOOK_URL: { description: 'Slack webhook URL', required: false },
  REDIS_URL: { description: 'Redis connection string', required: false },
};

class GitHubSecretsManager {
  constructor(octokit, owner, repo) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
  }

  async getPublicKey() {
    try {
      const { data } = await this.octokit.rest.actions.getRepoPublicKey({
        owner: this.owner,
        repo: this.repo,
      });
      return data;
    } catch (error) {
      throw new Error(`Failed to get repository public key: ${error.message}`);
    }
  }

  encryptSecret(secret, publicKey) {
    const key = createPublicKey({
      key: Buffer.from(publicKey, 'base64'),
      format: 'der',
      type: 'spki',
    });
    
    const encrypted = publicEncrypt(key, Buffer.from(secret, 'utf8'));
    return encrypted.toString('base64');
  }

  async setSecret(secretName, secretValue, publicKey) {
    try {
      const encryptedValue = this.encryptSecret(secretValue, publicKey.key);
      
      await this.octokit.rest.actions.createOrUpdateRepoSecret({
        owner: this.owner,
        repo: this.repo,
        secret_name: secretName,
        encrypted_value: encryptedValue,
        key_id: publicKey.key_id,
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to set secret ${secretName}: ${error.message}`);
      return false;
    }
  }

  async listSecrets() {
    try {
      const { data } = await this.octokit.rest.actions.listRepoSecrets({
        owner: this.owner,
        repo: this.repo,
      });
      return data.secrets;
    } catch (error) {
      throw new Error(`Failed to list secrets: ${error.message}`);
    }
  }
}

// Utility functions
function validateConfig() {
  const missing = [];
  
  if (!CONFIG.owner) missing.push('GITHUB_REPOSITORY_OWNER');
  if (!CONFIG.repo) missing.push('GITHUB_REPOSITORY_NAME');
  if (!CONFIG.token) missing.push('GITHUB_TOKEN');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(var_name => console.error(`   - ${var_name}`));
    console.error('\nUsage:');
    console.error('  GITHUB_TOKEN=your_token GITHUB_REPOSITORY_OWNER=owner GITHUB_REPOSITORY_NAME=repo node setup-secrets-api.js');
    console.error('\nOr set these in your environment.');
    process.exit(1);
  }
}

function createReadlineInterface() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl, question, hide = false) {
  return new Promise((resolve) => {
    if (hide) {
      // Hide input for sensitive data
      process.stdout.write(question);
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      let input = '';
      process.stdin.on('data', function(char) {
        char = char + '';
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write('\n');
            resolve(input);
            break;
          case '\u0003':
            process.exit();
            break;
          default:
            input += char;
            break;
        }
      });
    } else {
      rl.question(question, resolve);
    }
  });
}

async function loadSecretsFromFile(filename) {
  try {
    const content = readFileSync(filename, 'utf8');
    const secrets = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          secrets[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    return secrets;
  } catch (error) {
    throw new Error(`Failed to load secrets from file: ${error.message}`);
  }
}

async function main() {
  console.log('🔐 GitHub Secrets Setup using REST API\n');
  
  // Validate configuration
  validateConfig();
  
  // Initialize GitHub API client
  const octokit = new Octokit({ auth: CONFIG.token });
  const secretsManager = new GitHubSecretsManager(octokit, CONFIG.owner, CONFIG.repo);
  
  console.log(`📍 Repository: ${CONFIG.owner}/${CONFIG.repo}\n`);
  
  try {
    // Get repository public key for encryption
    console.log('🔑 Getting repository public key...');
    const publicKey = await secretsManager.getPublicKey();
    console.log('✅ Public key retrieved\n');
    
    // Check if user wants to load from file or input manually
    const rl = createReadlineInterface();
    const useFile = await askQuestion(rl, 'Load secrets from file? (y/N): ');
    
    let secretsToSet = {};
    
    if (useFile.toLowerCase() === 'y') {
      const filename = await askQuestion(rl, 'Enter filename (.env.secrets): ') || '.env.secrets';
      try {
        secretsToSet = await loadSecretsFromFile(filename);
        console.log(`📄 Loaded ${Object.keys(secretsToSet).length} secrets from ${filename}\n`);
      } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exit(1);
      }
    } else {
      // Input secrets manually
      console.log('📝 Enter secrets manually (values are hidden):\n');
      
      for (const [secretName, config] of Object.entries(SECRETS)) {
        console.log(`🔑 ${secretName}`);
        console.log(`   Description: ${config.description}`);
        console.log(`   Required: ${config.required ? 'Yes' : 'No'}`);
        
        const value = await askQuestion(rl, `   Enter value: `, true);
        
        if (value) {
          secretsToSet[secretName] = value;
        } else if (config.required) {
          console.log('❌ Required secret cannot be empty');
          process.exit(1);
        }
        console.log('');
      }
    }
    
    rl.close();
    
    // Set secrets
    console.log('🚀 Setting secrets in GitHub...\n');
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const [secretName, secretValue] of Object.entries(secretsToSet)) {
      if (SECRETS[secretName] || secretName.startsWith('CUSTOM_')) {
        process.stdout.write(`Setting ${secretName}... `);
        
        const success = await secretsManager.setSecret(secretName, secretValue, publicKey);
        
        if (success) {
          console.log('✅');
          successCount++;
        } else {
          console.log('❌');
          failureCount++;
        }
      } else {
        console.log(`⏭️  Skipping unknown secret: ${secretName}`);
      }
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`✅ Secrets set successfully: ${successCount}`);
    console.log(`❌ Secrets failed: ${failureCount}`);
    
    if (failureCount === 0) {
      console.log('\n🎉 All secrets configured successfully!');
      console.log('\nNext steps:');
      console.log('1. Verify secrets: gh secret list');
      console.log('2. Test CI/CD pipeline: git push origin main');
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { GitHubSecretsManager };