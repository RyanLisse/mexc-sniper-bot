#!/usr/bin/env node

/**
 * Claude Code Flow - Local Implementation
 * 
 * Advanced AI agent orchestration platform for development workflows
 * Implements the complete Claude Code Flow specification locally
 */

import { Command } from 'commander';
import { CoreSystem } from './core/system';
import { SparcManager } from './sparc/manager';
import { SwarmCoordinator } from './swarm/coordinator';
import { MemoryBank } from './memory/bank';
import { AgentPool } from './agents/pool';
import { MonitoringDashboard } from './monitoring/dashboard';
import { WorkflowEngine } from './workflows/engine';
import { TerminalPool } from './terminal/pool';
import { BatchOrchestrator } from './orchestration/batch-orchestrator';

const program = new Command();

// Global system instance
let coreSystem: CoreSystem;

async function initializeSystem(): Promise<CoreSystem> {
  if (!coreSystem) {
    coreSystem = new CoreSystem({
      projectRoot: process.cwd(),
      enableUI: false,
      enableMonitoring: true,
      enableBatchOptimization: true,
      maxAgents: 10,
      maxTasks: 100,
    });
    
    await coreSystem.initialize();
  }
  return coreSystem;
}

// Claude Code Flow CLI v1.0.72 - Complete Implementation
program
  .name('claude-flow')
  .description('AI agent orchestration platform for development workflows')
  .version('1.0.72')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--debug', 'Enable debug mode')
  .hook('preAction', async () => {
    await initializeSystem();
  });

// ============================================================================
// Core System Commands
// ============================================================================

program
  .command('init')
  .description('Initialize Claude-Flow project')
  .option('--sparc', 'Initialize with full SPARC development environment')
  .option('--force', 'Force overwrite existing configuration')
  .action(async (options) => {
    const system = await initializeSystem();
    await system.initializeProject(options);
  });

program
  .command('start')
  .description('Start orchestration system with optional web UI')
  .option('--ui', 'Start with web UI')
  .option('--port <port>', 'UI port', '3000')
  .option('--host <host>', 'UI host', 'localhost')
  .action(async (options) => {
    const system = await initializeSystem();
    await system.start(options);
  });

program
  .command('status')
  .description('Show comprehensive system status')
  .action(async () => {
    const system = await initializeSystem();
    const status = await system.getStatus();
    console.log(JSON.stringify(status, null, 2));
  });

program
  .command('monitor')
  .description('Real-time system monitoring dashboard')
  .action(async () => {
    const system = await initializeSystem();
    await system.startMonitoring();
  });

// Config subcommands
const configCmd = program
  .command('config')
  .description('Configuration management');

configCmd
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    const system = await initializeSystem();
    const config = await system.getConfig();
    console.log(JSON.stringify(config, null, 2));
  });

configCmd
  .command('set <key> <value>')
  .description('Set configuration value')
  .action(async (key, value) => {
    const system = await initializeSystem();
    await system.setConfig(key, value);
  });

configCmd
  .command('get <key>')
  .description('Get configuration value')
  .action(async (key) => {
    const system = await initializeSystem();
    const value = await system.getConfig(key);
    console.log(value);
  });

// ============================================================================
// Agent Management
// ============================================================================

const agentCmd = program
  .command('agent')
  .description('Manage AI agents');

agentCmd
  .command('spawn <type>')
  .description('Create AI agents (researcher, coder, analyst, etc.)')
  .option('--name <name>', 'Agent name')
  .option('--config <config>', 'Agent configuration JSON')
  .action(async (type, options) => {
    const system = await initializeSystem();
    const agent = await system.agentPool.spawn(type, options);
    console.log(`Agent spawned: ${agent.id} (${type})`);
  });

agentCmd
  .command('list')
  .description('List all active agents')
  .action(async () => {
    const system = await initializeSystem();
    const agents = await system.agentPool.list();
    console.table(agents);
  });

agentCmd
  .command('kill <agentId>')
  .description('Terminate an agent')
  .action(async (agentId) => {
    const system = await initializeSystem();
    await system.agentPool.kill(agentId);
    console.log(`Agent ${agentId} terminated`);
  });

// Alias for quick spawning
program
  .command('spawn <type>')
  .description('Quick agent spawning (alias for agent spawn)')
  .option('--name <name>', 'Agent name')
  .action(async (type, options) => {
    const system = await initializeSystem();
    const agent = await system.agentPool.spawn(type, options);
    console.log(`Agent spawned: ${agent.id} (${type})`);
  });

// ============================================================================
// Task Orchestration
// ============================================================================

const taskCmd = program
  .command('task')
  .description('Task coordination and management');

taskCmd
  .command('create <type> [description]')
  .description('Create and manage tasks')
  .option('--priority <priority>', 'Task priority (high, medium, low)', 'medium')
  .option('--assign <agentId>', 'Assign to specific agent')
  .action(async (type, description, options) => {
    const system = await initializeSystem();
    const task = await system.orchestrator.createTask(type, description, options);
    console.log(`Task created: ${task.id}`);
  });

taskCmd
  .command('list')
  .description('View active task queue')
  .action(async () => {
    const system = await initializeSystem();
    const tasks = await system.orchestrator.listTasks();
    console.table(tasks);
  });

taskCmd
  .command('status <taskId>')
  .description('Get task status')
  .action(async (taskId) => {
    const system = await initializeSystem();
    const status = await system.orchestrator.getTaskStatus(taskId);
    console.log(JSON.stringify(status, null, 2));
  });

program
  .command('workflow <file>')
  .description('Execute workflow automation files')
  .option('--vars <vars>', 'Workflow variables JSON')
  .action(async (file, options) => {
    const system = await initializeSystem();
    await system.workflowEngine.execute(file, options.vars);
  });

// ============================================================================
// Memory Management
// ============================================================================

const memoryCmd = program
  .command('memory')
  .description('Knowledge management and persistence');

memoryCmd
  .command('store <key> <data>')
  .description('Store persistent data across sessions')
  .action(async (key, data) => {
    const system = await initializeSystem();
    await system.memoryBank.store(key, data);
    console.log(`Stored: ${key}`);
  });

memoryCmd
  .command('get <key>')
  .description('Retrieve stored information')
  .action(async (key) => {
    const system = await initializeSystem();
    const data = await system.memoryBank.get(key);
    console.log(data);
  });

memoryCmd
  .command('list')
  .description('List all memory keys')
  .action(async () => {
    const system = await initializeSystem();
    const keys = await system.memoryBank.list();
    console.log(keys);
  });

memoryCmd
  .command('export <file>')
  .description('Export memory to file')
  .action(async (file) => {
    const system = await initializeSystem();
    await system.memoryBank.export(file);
    console.log(`Memory exported to: ${file}`);
  });

memoryCmd
  .command('import <file>')
  .description('Import memory from file')
  .action(async (file) => {
    const system = await initializeSystem();
    await system.memoryBank.import(file);
    console.log(`Memory imported from: ${file}`);
  });

memoryCmd
  .command('stats')
  .description('Memory usage statistics')
  .action(async () => {
    const system = await initializeSystem();
    const stats = await system.memoryBank.getStats();
    console.log(JSON.stringify(stats, null, 2));
  });

memoryCmd
  .command('cleanup')
  .description('Clean unused memory entries')
  .action(async () => {
    const system = await initializeSystem();
    const cleaned = await system.memoryBank.cleanup();
    console.log(`Cleaned ${cleaned} entries`);
  });

// ============================================================================
// SPARC Development Modes
// ============================================================================

const sparcCmd = program
  .command('sparc')
  .description('Specialized development modes');

sparcCmd
  .command('run <mode> <task>')
  .description('Run specific SPARC mode')
  .option('--config <config>', 'Mode configuration JSON')
  .action(async (mode, task, options) => {
    const system = await initializeSystem();
    await system.sparcManager.run(mode, task, options);
  });

sparcCmd
  .command('modes')
  .description('List all 17 available SPARC modes')
  .action(async () => {
    const system = await initializeSystem();
    const modes = await system.sparcManager.listModes();
    console.table(modes);
  });

sparcCmd
  .command('tdd <feature>')
  .description('Test-driven development mode')
  .action(async (feature, options) => {
    const system = await initializeSystem();
    await system.sparcManager.run('tdd', feature, options);
  });

// Default SPARC command (orchestrator mode)
program
  .command('sparc <task>')
  .description('Run orchestrator mode (default)')
  .action(async (task, options) => {
    const system = await initializeSystem();
    await system.sparcManager.run('orchestrator', task, options);
  });

// ============================================================================
// Swarm Coordination
// ============================================================================

program
  .command('swarm <objective>')
  .description('Multi-agent swarm coordination')
  .option('--strategy <strategy>', 'Coordination strategy', 'auto')
  .option('--mode <mode>', 'Coordination mode', 'centralized')
  .option('--max-agents <n>', 'Maximum number of agents', '5')
  .option('--parallel', 'Enable parallel execution')
  .option('--monitor', 'Real-time monitoring')
  .option('--output <format>', 'Output format', 'json')
  .action(async (objective, options) => {
    const system = await initializeSystem();
    await system.swarmCoordinator.execute(objective, options);
  });

// ============================================================================
// Session Management
// ============================================================================

program
  .command('session')
  .description('Manage terminal sessions')
  .action(async () => {
    const system = await initializeSystem();
    await system.terminalPool.manageSessions();
  });

program
  .command('repl')
  .description('Start interactive REPL mode')
  .action(async () => {
    const system = await initializeSystem();
    await system.startREPL();
  });

// ============================================================================
// Error Handling
// ============================================================================

program.exitOverride();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  program.parse();
}

export { program };