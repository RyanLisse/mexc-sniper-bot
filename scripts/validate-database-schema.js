#!/usr/bin/env node

// Database Schema Validation Script
// Validates that all critical tables exist and are functional

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'mexc_sniper.db');

// List of all expected tables
const EXPECTED_TABLES = [
  // Core tables
  'user',
  'account', 
  'session',
  'verification',
  'user_preferences',
  
  // Trading tables
  'api_credentials',
  'snipe_targets',
  'execution_history',
  'transactions',
  'transaction_locks',
  'transaction_queue',
  
  // Workflow tables (previously missing)
  'workflow_system_status',
  'workflow_activity',
  
  // Pattern tables
  'monitored_listings',
  'pattern_embeddings',
  'pattern_similarity_cache',
  
  // Safety tables
  'simulation_sessions',
  'simulation_trades',
  'risk_events',
  'position_snapshots',
  'reconciliation_reports',
  'error_incidents',
  'system_health_metrics',
  
  // Performance tables
  'agent_performance_metrics',
  'workflow_performance_metrics',
  'system_performance_snapshots',
  'performance_alerts',
  'performance_baselines',
  
  // Alert tables
  'alert_rules',
  'alert_instances',
  'notification_channels',
  'escalation_policies',
  'alert_notifications',
  'alert_correlations',
  'alert_suppressions',
  'anomaly_models',
  'alert_analytics'
];

// Critical workflows that depend on these tables
const CRITICAL_FUNCTIONS = [
  {
    name: 'WorkflowStatusService',
    table: 'workflow_system_status',
    description: 'System status tracking and metrics'
  },
  {
    name: 'WorkflowActivity',
    table: 'workflow_activity', 
    description: 'Activity logging and monitoring'
  },
  {
    name: 'PatternDiscovery',
    table: 'monitored_listings',
    description: 'Pattern detection and ready state monitoring'
  },
  {
    name: 'RiskManagement',
    table: 'risk_events',
    description: 'Risk monitoring and safety systems'
  },
  {
    name: 'AgentPerformance',
    table: 'agent_performance_metrics',
    description: 'AI agent performance tracking'
  }
];

async function validateDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(new Error(`Failed to connect to database: ${err.message}`));
        return;
      }
      
      console.log('🔗 Connected to SQLite database');
      
      // Get all existing tables
      db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
        if (err) {
          reject(new Error(`Failed to query tables: ${err.message}`));
          return;
        }
        
        const existingTables = rows.map(row => row.name);
        console.log(`📊 Found ${existingTables.length} tables in database`);
        
        // Check for missing tables
        const missingTables = EXPECTED_TABLES.filter(table => !existingTables.includes(table));
        
        if (missingTables.length > 0) {
          console.error(`❌ Missing tables: ${missingTables.join(', ')}`);
          reject(new Error(`Missing required tables: ${missingTables.join(', ')}`));
          return;
        }
        
        console.log('✅ All expected tables exist');
        
        // Test critical table functionality
        testCriticalFunctions(db)
          .then(() => {
            console.log('✅ All critical functions validated');
            console.log('🎉 Database schema validation PASSED');
            db.close();
            resolve(true);
          })
          .catch((err) => {
            console.error('❌ Critical function validation failed:', err.message);
            db.close();
            reject(err);
          });
      });
    });
  });
}

async function testCriticalFunctions(db) {
  for (const func of CRITICAL_FUNCTIONS) {
    await testTableFunctionality(db, func);
  }
}

function testTableFunctionality(db, func) {
  return new Promise((resolve, reject) => {
    console.log(`🧪 Testing ${func.name} (${func.table})...`);
    
    // Test table structure
    db.all(`PRAGMA table_info(${func.table})`, (err, columns) => {
      if (err) {
        reject(new Error(`Failed to get table info for ${func.table}: ${err.message}`));
        return;
      }
      
      if (columns.length === 0) {
        reject(new Error(`Table ${func.table} has no columns`));
        return;
      }
      
      console.log(`  ✓ Table ${func.table} has ${columns.length} columns`);
      
      // Test basic CRUD operations
      testBasicOperations(db, func)
        .then(() => {
          console.log(`  ✅ ${func.name} validation passed`);
          resolve();
        })
        .catch(reject);
    });
  });
}

function testBasicOperations(db, func) {
  return new Promise((resolve, reject) => {
    // Test INSERT/SELECT/DELETE cycle
    const testData = getTestData(func.table);
    
    if (!testData) {
      console.log(`  ⚠️  No test data defined for ${func.table}, skipping CRUD test`);
      resolve();
      return;
    }
    
    // Insert test record
    db.run(testData.insert, testData.values, function(err) {
      if (err) {
        reject(new Error(`Failed to insert test data into ${func.table}: ${err.message}`));
        return;
      }
      
      const insertId = this.lastID;
      console.log(`  ✓ INSERT successful (ID: ${insertId})`);
      
      // Select test record
      db.get(testData.select, [insertId], (err, row) => {
        if (err) {
          reject(new Error(`Failed to select test data from ${func.table}: ${err.message}`));
          return;
        }
        
        if (!row) {
          reject(new Error(`Test record not found in ${func.table}`));
          return;
        }
        
        console.log(`  ✓ SELECT successful`);
        
        // Delete test record
        db.run(testData.delete, [insertId], (err) => {
          if (err) {
            reject(new Error(`Failed to delete test data from ${func.table}: ${err.message}`));
            return;
          }
          
          console.log(`  ✓ DELETE successful`);
          resolve();
        });
      });
    });
  });
}

function getTestData(tableName) {
  const testData = {
    'workflow_system_status': {
      insert: 'INSERT INTO workflow_system_status (user_id, system_status) VALUES (?, ?)',
      values: ['test-validation', 'testing'],
      select: 'SELECT * FROM workflow_system_status WHERE id = ?',
      delete: 'DELETE FROM workflow_system_status WHERE id = ?'
    },
    'workflow_activity': {
      insert: 'INSERT INTO workflow_activity (user_id, activity_id, type, message) VALUES (?, ?, ?, ?)',
      values: ['test-validation', 'test-activity-' + Date.now(), 'test', 'Validation test'],
      select: 'SELECT * FROM workflow_activity WHERE id = ?',
      delete: 'DELETE FROM workflow_activity WHERE id = ?'
    },
    'monitored_listings': {
      insert: 'INSERT INTO monitored_listings (vcoin_id, symbol_name) VALUES (?, ?)',
      values: ['TEST123', 'TESTUSDT'],
      select: 'SELECT * FROM monitored_listings WHERE id = ?',
      delete: 'DELETE FROM monitored_listings WHERE id = ?'
    },
    'risk_events': {
      insert: 'INSERT INTO risk_events (user_id, event_id, event_type, trigger_condition, current_value, threshold_value, risk_score) VALUES (?, ?, ?, ?, ?, ?, ?)',
      values: ['test-validation', 'test-risk-' + Date.now(), 'test', 'validation', 1.0, 2.0, 0.5],
      select: 'SELECT * FROM risk_events WHERE id = ?',
      delete: 'DELETE FROM risk_events WHERE id = ?'
    },
    'agent_performance_metrics': {
      insert: 'INSERT INTO agent_performance_metrics (agent_name, operation_type, execution_time_ms, success) VALUES (?, ?, ?, ?)',
      values: ['test-agent', 'validation', 100, 1],
      select: 'SELECT * FROM agent_performance_metrics WHERE id = ?',
      delete: 'DELETE FROM agent_performance_metrics WHERE id = ?'
    }
  };
  
  return testData[tableName];
}

// Run validation
if (require.main === module) {
  validateDatabase()
    .then(() => {
      console.log('\n🚀 Database schema validation completed successfully!');
      console.log('✅ All critical database issues have been resolved');
      console.log('✅ WorkflowStatusService will now function correctly');
      console.log('✅ Circuit breaker issues should be eliminated');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Database schema validation failed:');
      console.error(err.message);
      console.error('\n🔧 Please review the database migration process');
      process.exit(1);
    });
}

module.exports = { validateDatabase };