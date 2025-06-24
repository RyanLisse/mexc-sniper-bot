#!/usr/bin/env node

/**
 * Claude Code Flow - Local Implementation
 *
 * Advanced AI agent orchestration platform for development workflows
 * Implements the complete Claude Code Flow specification locally
 */

import { Command } from "commander";
import { createSafeLogger } from "../lib/structured-logger";
import { CoreSystem, type CoreSystemConstructorConfig } from "./core/system";

const program = new Command();

// Global system instance
let coreSystem: CoreSystem;

const logger = createSafeLogger("cli");

async function initializeSystem(): Promise<CoreSystem> {
  if (!coreSystem) {
    const config: CoreSystemConstructorConfig = {
      projectRoot: process.cwd(),
      enableUI: false,
      enableMonitoring: true,
      enableBatchOptimization: true,
      maxAgents: 10,
      maxTasks: 100,
    };
    coreSystem = new CoreSystem(config);

    await coreSystem.initialize();
  }
  return coreSystem;
}

// Claude Code Flow CLI v1.0.72 - Complete Implementation
program
  .name("claude-flow")
  .description("AI agent orchestration platform for development workflows")
  .version("1.0.72")
  .option("-v, --verbose", "Enable verbose logging")
  .option("--debug", "Enable debug mode");

// ============================================================================
// Core System Commands
// ============================================================================

program
  .command("init")
  .description("Initialize Claude-Flow project")
  .option("--sparc", "Initialize with full SPARC development environment")
  .option("--force", "Force overwrite existing configuration")
  .action(async (options) => {
    const system = await initializeSystem();
    await system.initializeProject(options);
  });

program
  .command("start")
  .description("Start orchestration system with optional web UI")
  .option("--ui", "Start with web UI")
  .option("--port <port>", "UI port", "3000")
  .option("--host <host>", "UI host", "localhost")
  .action(async (options) => {
    const system = await initializeSystem();
    await system.start(options);
  });

program
  .command("status")
  .description("Show comprehensive system status")
  .action(async () => {
    const system = await initializeSystem();
    const status = await system.getStatus();
    logger.info(JSON.stringify(status, null, 2));
  });

program
  .command("monitor")
  .description("Real-time system monitoring dashboard")
  .action(async () => {
    const system = await initializeSystem();
    await system.startMonitoring();
  });

// Config subcommands
const configCmd = program.command("config").description("Configuration management");

configCmd
  .command("show")
  .description("Show current configuration")
  .action(async () => {
    const system = await initializeSystem();
    const config = await system.getConfig();
    logger.info(JSON.stringify(config, null, 2));
  });

configCmd
  .command("set <key> <value>")
  .description("Set configuration value")
  .action(async (key, value) => {
    const system = await initializeSystem();
    await system.setConfig(key, value);
  });

configCmd
  .command("get <key>")
  .description("Get configuration value")
  .action(async (key: string) => {
    const system = await initializeSystem();
    const value = await system.getConfig(key);
    logger.info(value);
  });

// ============================================================================
// Agent Management
// ============================================================================

const agentCmd = program.command("agent").description("Manage AI agents");

agentCmd
  .command("spawn <type>")
  .description("Create AI agents (researcher, coder, analyst, etc.)")
  .option("--name <name>", "Agent name")
  .option("--config <config>", "Agent configuration JSON")
  .action(async (type, options) => {
    const system = await initializeSystem();
    const agent = await system.agentPool.spawn(type, options);
    logger.info(`Agent spawned: ${agent.id} (${type})`);
  });

agentCmd
  .command("list")
  .description("List all active agents")
  .action(async () => {
    const system = await initializeSystem();
    const agents = await system.agentPool.list();
    console.table(agents);
  });

agentCmd
  .command("kill <agentId>")
  .description("Terminate an agent")
  .action(async (agentId) => {
    const system = await initializeSystem();
    await system.agentPool.kill(agentId);
    logger.info(`Agent ${agentId} terminated`);
  });

// Alias for quick spawning
program
  .command("spawn <type>")
  .description("Quick agent spawning (alias for agent spawn)")
  .option("--name <name>", "Agent name")
  .action(async (type, options) => {
    const system = await initializeSystem();
    const agent = await system.agentPool.spawn(type, options);
    logger.info(`Agent spawned: ${agent.id} (${type})`);
  });

// ============================================================================
// Task Orchestration
// ============================================================================

const taskCmd = program.command("task").description("Task coordination and management");

taskCmd
  .command("create <type> [description]")
  .description("Create and manage tasks")
  .option("--priority <priority>", "Task priority (high, medium, low)", "medium")
  .option("--assign <agentId>", "Assign to specific agent")
  .action(async (type, description, options) => {
    const system = await initializeSystem();
    const task = await system.orchestrator.createTask(type, description, options);
    logger.info(`Task created: ${task.id}`);
  });

taskCmd
  .command("list")
  .description("View active task queue")
  .action(async () => {
    const system = await initializeSystem();
    const tasks = await system.orchestrator.listTasks();
    console.table(tasks);
  });

taskCmd
  .command("status <taskId>")
  .description("Get task status")
  .action(async (taskId) => {
    const system = await initializeSystem();
    const status = await system.orchestrator.getTaskStatus(taskId);
    logger.info(JSON.stringify(status, null, 2));
  });

program
  .command("workflow <file>")
  .description("Execute workflow automation files")
  .option("--vars <vars>", "Workflow variables JSON")
  .action(async (file, options) => {
    const system = await initializeSystem();
    await system.workflowEngine.execute(file, options.vars);
  });

// ============================================================================
// Memory Management
// ============================================================================

const memoryCmd = program.command("memory").description("Knowledge management and persistence");

memoryCmd
  .command("store <key> <data>")
  .description("Store persistent data across sessions")
  .action(async (key, data) => {
    const system = await initializeSystem();
    await system.memoryBank.store(key, data);
    logger.info(`Stored: ${key}`);
  });

memoryCmd
  .command("get <key>")
  .description("Retrieve stored information")
  .action(async (key: string) => {
    const system = await initializeSystem();
    const data = await system.memoryBank.get(key);
    logger.info(data);
  });

memoryCmd
  .command("list")
  .description("List all memory keys")
  .action(async () => {
    const system = await initializeSystem();
    const keys = await system.memoryBank.list();
    logger.info(JSON.stringify(keys, null, 2));
  });

memoryCmd
  .command("export <file>")
  .description("Export memory to file")
  .action(async (file) => {
    const system = await initializeSystem();
    await system.memoryBank.export(file);
    logger.info(`Memory exported to: ${file}`);
  });

memoryCmd
  .command("import <file>")
  .description("Import memory from file")
  .action(async (file) => {
    const system = await initializeSystem();
    await system.memoryBank.import(file);
    logger.info(`Memory imported from: ${file}`);
  });

memoryCmd
  .command("stats")
  .description("Memory usage statistics")
  .action(async () => {
    const system = await initializeSystem();
    const stats = await system.memoryBank.getStats();
    logger.info(JSON.stringify(stats, null, 2));
  });

memoryCmd
  .command("cleanup")
  .description("Clean unused memory entries")
  .action(async () => {
    const system = await initializeSystem();
    const cleaned = await system.memoryBank.cleanup();
    logger.info(`Cleaned ${cleaned} entries`);
  });

// ============================================================================
// SPARC Development Modes
// ============================================================================

const sparcCmd = program.command("sparc").description("Specialized development modes");

sparcCmd
  .command("run <mode> <task>")
  .description("Run specific SPARC mode")
  .option("--config <config>", "Mode configuration JSON")
  .action(async (mode, task, options) => {
    const system = await initializeSystem();
    await system.sparcManager.run(mode, task, options);
  });

sparcCmd
  .command("modes")
  .description("List all 17 available SPARC modes")
  .action(async () => {
    const system = await initializeSystem();
    const modes = await system.sparcManager.listModes();
    console.table(modes);
  });

sparcCmd
  .command("tdd <feature>")
  .description("Test-driven development mode")
  .action(async (feature, options) => {
    const system = await initializeSystem();
    await system.sparcManager.run("tdd", feature, options);
  });

// Default SPARC command (orchestrator mode)
program
  .command("sparc <task>")
  .description("Run orchestrator mode (default)")
  .action(async (task, options) => {
    const system = await initializeSystem();
    await system.sparcManager.run("orchestrator", task, options);
  });

// ============================================================================
// Swarm Coordination
// ============================================================================

program
  .command("swarm <objective>")
  .description("Multi-agent swarm coordination")
  .option("--strategy <strategy>", "Coordination strategy", "auto")
  .option("--mode <mode>", "Coordination mode", "centralized")
  .option("--max-agents <n>", "Maximum number of agents", "5")
  .option("--parallel", "Enable parallel execution")
  .option("--monitor", "Real-time monitoring")
  .option("--output <format>", "Output format", "json")
  .action(async (objective, options) => {
    const system = await initializeSystem();
    await system.swarmCoordinator.execute(objective, options);
  });

// ============================================================================
// Session Management
// ============================================================================

program
  .command("session")
  .description("Manage terminal sessions")
  .action(async () => {
    const system = await initializeSystem();
    await system.terminalPool.manageSessions();
  });

program
  .command("repl")
  .description("Start interactive REPL mode")
  .action(async () => {
    const system = await initializeSystem();
    await system.startREPL();
  });

// ============================================================================
// Error Handling
// ============================================================================

program.exitOverride();

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", { promise, reason });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
  program.parse(process.argv);
}

export { program };
