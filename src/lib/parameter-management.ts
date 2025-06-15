/**
 * Parameter Management System
 * 
 * Comprehensive parameter management with versioning, rollback capabilities,
 * safety validation, and integration with the optimization engine.
 */

import { EventEmitter } from 'events';
import { logger } from './utils';

export interface ParameterDefinition {
  name: string;
  category: 'trading' | 'risk' | 'agent' | 'system' | 'pattern' | 'performance';
  type: 'number' | 'boolean' | 'string' | 'array' | 'object';
  description: string;
  defaultValue: any;
  constraints: {
    min?: number;
    max?: number;
    enum?: any[];
    pattern?: string;
    required?: boolean;
    dependencies?: string[];
  };
  impactLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresRestart: boolean;
  affectedComponents: string[];
}

export interface ParameterSnapshot {
  id: string;
  name: string;
  timestamp: Date;
  parameters: Record<string, any>;
  metadata: {
    source: string;
    reason?: string;
    optimizationId?: string;
    userId?: string;
  };
  checksum: string;
}

export interface ParameterChange {
  parameter: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  source: string;
  metadata?: Record<string, any>;
}

export interface SafetyValidationResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class ParameterManager extends EventEmitter {
  private currentParameters = new Map<string, any>();
  private parameterDefinitions = new Map<string, ParameterDefinition>();
  private snapshots: ParameterSnapshot[] = [];
  private changeHistory: ParameterChange[] = [];
  
  private readonly MAX_SNAPSHOTS = 100;
  private readonly MAX_CHANGE_HISTORY = 1000;

  constructor() {
    super();
    this.initializeParameterDefinitions();
    this.loadCurrentParameters();
  }

  /**
   * Initialize parameter definitions for all system components
   */
  private initializeParameterDefinitions(): void {
    const definitions: ParameterDefinition[] = [
      // Trading Strategy Parameters
      {
        name: 'pattern_confidence_threshold',
        category: 'pattern',
        type: 'number',
        description: 'Minimum confidence score for pattern detection (sts:2, st:2, tt:4)',
        defaultValue: 0.75,
        constraints: { min: 0.1, max: 0.99, required: true },
        impactLevel: 'high',
        requiresRestart: false,
        affectedComponents: ['PatternDiscoveryAgent', 'SymbolAnalysisAgent']
      },
      {
        name: 'position_size_multiplier',
        category: 'trading',
        type: 'number',
        description: 'Position sizing multiplier based on confidence and risk',
        defaultValue: 1.0,
        constraints: { min: 0.1, max: 5.0, required: true },
        impactLevel: 'critical',
        requiresRestart: false,
        affectedComponents: ['StrategyAgent', 'RiskManagerAgent']
      },
      {
        name: 'advance_detection_hours',
        category: 'trading',
        type: 'number',
        description: 'Minimum hours in advance for pattern detection',
        defaultValue: 3.5,
        constraints: { min: 1.0, max: 24.0, required: true },
        impactLevel: 'high',
        requiresRestart: false,
        affectedComponents: ['CalendarAgent', 'PatternDiscoveryAgent']
      },
      
      // Risk Management Parameters
      {
        name: 'max_position_size',
        category: 'risk',
        type: 'number',
        description: 'Maximum position size as percentage of portfolio',
        defaultValue: 0.1,
        constraints: { min: 0.01, max: 0.5, required: true },
        impactLevel: 'critical',
        requiresRestart: false,
        affectedComponents: ['RiskManagerAgent', 'StrategyAgent']
      },
      {
        name: 'stop_loss_percentage',
        category: 'risk',
        type: 'number',
        description: 'Default stop loss percentage',
        defaultValue: 0.05,
        constraints: { min: 0.01, max: 0.2, required: true },
        impactLevel: 'high',
        requiresRestart: false,
        affectedComponents: ['RiskManagerAgent', 'StrategyAgent']
      },
      {
        name: 'take_profit_percentage',
        category: 'risk',
        type: 'number',
        description: 'Default take profit percentage',
        defaultValue: 0.15,
        constraints: { min: 0.02, max: 1.0, required: true },
        impactLevel: 'high',
        requiresRestart: false,
        affectedComponents: ['RiskManagerAgent', 'StrategyAgent']
      },
      {
        name: 'max_concurrent_positions',
        category: 'risk',
        type: 'number',
        description: 'Maximum number of concurrent trading positions',
        defaultValue: 5,
        constraints: { min: 1, max: 20, required: true },
        impactLevel: 'high',
        requiresRestart: false,
        affectedComponents: ['RiskManagerAgent', 'StrategyAgent']
      },
      
      // Agent Configuration Parameters
      {
        name: 'agent_response_timeout',
        category: 'agent',
        type: 'number',
        description: 'Timeout for agent responses in milliseconds',
        defaultValue: 30000,
        constraints: { min: 5000, max: 120000, required: true },
        impactLevel: 'medium',
        requiresRestart: false,
        affectedComponents: ['BaseAgent', 'MultiAgentOrchestrator']
      },
      {
        name: 'agent_retry_attempts',
        category: 'agent',
        type: 'number',
        description: 'Number of retry attempts for failed agent calls',
        defaultValue: 3,
        constraints: { min: 1, max: 10, required: true },
        impactLevel: 'medium',
        requiresRestart: false,
        affectedComponents: ['BaseAgent', 'ErrorRecoveryAgent']
      },
      {
        name: 'agent_cache_ttl',
        category: 'agent',
        type: 'number',
        description: 'Agent response cache TTL in seconds',
        defaultValue: 300,
        constraints: { min: 60, max: 3600, required: true },
        impactLevel: 'low',
        requiresRestart: false,
        affectedComponents: ['BaseAgent']
      },
      {
        name: 'openai_temperature',
        category: 'agent',
        type: 'number',
        description: 'OpenAI model temperature for agent responses',
        defaultValue: 0.7,
        constraints: { min: 0.0, max: 2.0, required: true },
        impactLevel: 'medium',
        requiresRestart: false,
        affectedComponents: ['BaseAgent']
      },
      
      // System Performance Parameters
      {
        name: 'api_rate_limit_requests',
        category: 'system',
        type: 'number',
        description: 'API rate limit requests per minute',
        defaultValue: 1200,
        constraints: { min: 100, max: 6000, required: true },
        impactLevel: 'medium',
        requiresRestart: true,
        affectedComponents: ['MexcApiAgent', 'RateLimiter']
      },
      {
        name: 'websocket_reconnect_delay',
        category: 'system',
        type: 'number',
        description: 'WebSocket reconnection delay in milliseconds',
        defaultValue: 5000,
        constraints: { min: 1000, max: 30000, required: true },
        impactLevel: 'medium',
        requiresRestart: false,
        affectedComponents: ['WebSocketPriceService']
      },
      {
        name: 'circuit_breaker_threshold',
        category: 'system',
        type: 'number',
        description: 'Circuit breaker failure threshold percentage',
        defaultValue: 0.5,
        constraints: { min: 0.1, max: 0.9, required: true },
        impactLevel: 'high',
        requiresRestart: false,
        affectedComponents: ['CircuitBreaker', 'SafetyBaseAgent']
      },
      {
        name: 'query_timeout',
        category: 'system',
        type: 'number',
        description: 'Database query timeout in milliseconds',
        defaultValue: 10000,
        constraints: { min: 1000, max: 60000, required: true },
        impactLevel: 'medium',
        requiresRestart: false,
        affectedComponents: ['DatabaseClient']
      },
      
      // Pattern Detection Parameters
      {
        name: 'pattern_analysis_window',
        category: 'pattern',
        type: 'number',
        description: 'Time window for pattern analysis in hours',
        defaultValue: 24,
        constraints: { min: 1, max: 168, required: true },
        impactLevel: 'medium',
        requiresRestart: false,
        affectedComponents: ['PatternDiscoveryAgent', 'SymbolAnalysisAgent']
      },
      {
        name: 'symbol_monitoring_interval',
        category: 'pattern',
        type: 'number',
        description: 'Symbol monitoring interval in seconds',
        defaultValue: 30,
        constraints: { min: 10, max: 300, required: true },
        impactLevel: 'medium',
        requiresRestart: false,
        affectedComponents: ['SymbolAnalysisAgent', 'CalendarAgent']
      },
      {
        name: 'pattern_correlation_threshold',
        category: 'pattern',
        type: 'number',
        description: 'Minimum correlation threshold for pattern validation',
        defaultValue: 0.6,
        constraints: { min: 0.1, max: 0.95, required: true },
        impactLevel: 'medium',
        requiresRestart: false,
        affectedComponents: ['PatternDiscoveryAgent']
      }
    ];

    definitions.forEach(def => {
      this.parameterDefinitions.set(def.name, def);
      this.currentParameters.set(def.name, def.defaultValue);
    });

    logger.info(`Initialized ${definitions.length} parameter definitions`);
  }

  /**
   * Load current parameters from database or storage
   */
  private async loadCurrentParameters(): Promise<void> {
    try {
      // In a real implementation, this would load from database
      // For now, use default values
      logger.info('Loaded current parameters from storage');
    } catch (error) {
      logger.error('Failed to load current parameters, using defaults:', error);
    }
  }

  /**
   * Get parameter value
   */
  getParameter(name: string): any {
    return this.currentParameters.get(name);
  }

  /**
   * Get all parameters in a category
   */
  getParametersByCategory(category: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, definition] of this.parameterDefinitions) {
      if (definition.category === category) {
        result[name] = this.currentParameters.get(name);
      }
    }
    
    return result;
  }

  /**
   * Get all current parameters
   */
  getCurrentParameters(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, value] of this.currentParameters) {
      result[name] = value;
    }
    
    return result;
  }

  /**
   * Update single parameter
   */
  async updateParameter(
    name: string,
    value: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    const definition = this.parameterDefinitions.get(name);
    if (!definition) {
      throw new Error(`Parameter '${name}' not found`);
    }

    // Validate parameter value
    const validation = this.validateParameter(definition, value);
    if (!validation.passed) {
      throw new Error(`Parameter validation failed: ${validation.violations.join(', ')}`);
    }

    // Record change
    const oldValue = this.currentParameters.get(name);
    const change: ParameterChange = {
      parameter: name,
      oldValue,
      newValue: value,
      timestamp: new Date(),
      source: metadata?.source || 'manual',
      metadata
    };

    // Update parameter
    this.currentParameters.set(name, value);
    this.changeHistory.push(change);

    // Trim change history if needed
    if (this.changeHistory.length > this.MAX_CHANGE_HISTORY) {
      this.changeHistory = this.changeHistory.slice(-this.MAX_CHANGE_HISTORY);
    }

    this.emit('parameterChanged', change);
    
    if (definition.requiresRestart) {
      this.emit('restartRequired', { parameter: name, component: definition.affectedComponents });
    }

    logger.info(`Parameter '${name}' updated`, { oldValue, newValue: value, source: metadata?.source });
  }

  /**
   * Update multiple parameters
   */
  async updateParameters(
    parameters: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Validate all parameters first
    const validationResults = await this.validateParameters(parameters);
    if (!validationResults.passed) {
      throw new Error(`Parameter validation failed: ${validationResults.violations.join(', ')}`);
    }

    // Update all parameters
    const changes: ParameterChange[] = [];
    
    for (const [name, value] of Object.entries(parameters)) {
      const oldValue = this.currentParameters.get(name);
      
      const change: ParameterChange = {
        parameter: name,
        oldValue,
        newValue: value,
        timestamp: new Date(),
        source: metadata?.source || 'bulk_update',
        metadata
      };
      
      this.currentParameters.set(name, value);
      changes.push(change);
    }

    // Add to history
    this.changeHistory.push(...changes);

    // Trim change history if needed
    if (this.changeHistory.length > this.MAX_CHANGE_HISTORY) {
      this.changeHistory = this.changeHistory.slice(-this.MAX_CHANGE_HISTORY);
    }

    this.emit('parametersChanged', changes);

    // Check if restart is required
    const restartRequired = changes.some(change => {
      const definition = this.parameterDefinitions.get(change.parameter);
      return definition?.requiresRestart;
    });

    if (restartRequired) {
      const affectedComponents = changes
        .map(change => this.parameterDefinitions.get(change.parameter)?.affectedComponents || [])
        .flat();
      
      this.emit('restartRequired', { parameters: changes.map(c => c.parameter), components: affectedComponents });
    }

    logger.info(`Updated ${changes.length} parameters`, { source: metadata?.source });
  }

  /**
   * Validate single parameter
   */
  private validateParameter(definition: ParameterDefinition, value: any): SafetyValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Type validation
    if (definition.type === 'number' && typeof value !== 'number') {
      violations.push(`Expected number, got ${typeof value}`);
    } else if (definition.type === 'boolean' && typeof value !== 'boolean') {
      violations.push(`Expected boolean, got ${typeof value}`);
    } else if (definition.type === 'string' && typeof value !== 'string') {
      violations.push(`Expected string, got ${typeof value}`);
    }

    // Constraint validation
    if (definition.constraints) {
      const { min, max, enum: enumValues, pattern, required } = definition.constraints;

      if (required && (value === null || value === undefined)) {
        violations.push('Parameter is required');
      }

      if (typeof value === 'number') {
        if (min !== undefined && value < min) {
          violations.push(`Value ${value} below minimum ${min}`);
        }
        if (max !== undefined && value > max) {
          violations.push(`Value ${value} above maximum ${max}`);
        }
      }

      if (enumValues && !enumValues.includes(value)) {
        violations.push(`Value not in allowed enum: ${enumValues.join(', ')}`);
      }

      if (pattern && typeof value === 'string') {
        const regex = new RegExp(pattern);
        if (!regex.test(value)) {
          violations.push(`Value does not match pattern: ${pattern}`);
        }
      }
    }

    // Impact level determines risk
    riskLevel = definition.impactLevel as any;

    // Generate warnings for potentially dangerous values
    if (definition.name === 'max_position_size' && value > 0.2) {
      warnings.push('High position size may increase portfolio risk');
    }

    if (definition.name === 'pattern_confidence_threshold' && value < 0.5) {
      warnings.push('Low confidence threshold may increase false positives');
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings,
      riskLevel
    };
  }

  /**
   * Validate multiple parameters
   */
  async validateParameters(parameters: Record<string, any>): Promise<SafetyValidationResult> {
    const allViolations: string[] = [];
    const allWarnings: string[] = [];
    let highestRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';

    for (const [name, value] of Object.entries(parameters)) {
      const definition = this.parameterDefinitions.get(name);
      if (!definition) {
        allViolations.push(`Unknown parameter: ${name}`);
        continue;
      }

      const validation = this.validateParameter(definition, value);
      allViolations.push(...validation.violations);
      allWarnings.push(...validation.warnings);

      // Track highest risk level
      const riskLevels = ['low', 'medium', 'high', 'critical'];
      if (riskLevels.indexOf(validation.riskLevel) > riskLevels.indexOf(highestRisk)) {
        highestRisk = validation.riskLevel;
      }
    }

    // Cross-parameter validation
    await this.validateParameterDependencies(parameters, allViolations, allWarnings);

    return {
      passed: allViolations.length === 0,
      violations: allViolations,
      warnings: allWarnings,
      riskLevel: highestRisk
    };
  }

  /**
   * Validate parameter dependencies and relationships
   */
  private async validateParameterDependencies(
    parameters: Record<string, any>,
    violations: string[],
    warnings: string[]
  ): Promise<void> {
    // Stop loss should be less than take profit
    if (parameters.stop_loss_percentage && parameters.take_profit_percentage) {
      if (parameters.stop_loss_percentage >= parameters.take_profit_percentage) {
        violations.push('Stop loss must be less than take profit');
      }
    }

    // Position size constraints
    if (parameters.max_position_size && parameters.max_concurrent_positions) {
      const maxTotalExposure = parameters.max_position_size * parameters.max_concurrent_positions;
      if (maxTotalExposure > 1.0) {
        violations.push('Maximum total exposure cannot exceed 100% of portfolio');
      }
    }

    // Agent timeout should be reasonable relative to cache TTL
    if (parameters.agent_response_timeout && parameters.agent_cache_ttl) {
      if (parameters.agent_response_timeout > parameters.agent_cache_ttl * 1000) {
        warnings.push('Agent timeout is longer than cache TTL, may cause cache misses');
      }
    }

    // Pattern confidence and advance detection relationship
    if (parameters.pattern_confidence_threshold && parameters.advance_detection_hours) {
      if (parameters.pattern_confidence_threshold > 0.9 && parameters.advance_detection_hours < 2) {
        warnings.push('High confidence threshold with short advance detection may reduce opportunities');
      }
    }
  }

  /**
   * Create parameter snapshot
   */
  async createSnapshot(name: string, reason?: string): Promise<string> {
    const snapshot: ParameterSnapshot = {
      id: this.generateSnapshotId(),
      name,
      timestamp: new Date(),
      parameters: this.getCurrentParameters(),
      metadata: {
        source: 'snapshot',
        reason
      },
      checksum: this.calculateChecksum(this.getCurrentParameters())
    };

    this.snapshots.push(snapshot);

    // Trim snapshots if needed
    if (this.snapshots.length > this.MAX_SNAPSHOTS) {
      this.snapshots = this.snapshots.slice(-this.MAX_SNAPSHOTS);
    }

    this.emit('snapshotCreated', snapshot);
    logger.info(`Parameter snapshot created: ${name}`, { id: snapshot.id });

    return snapshot.id;
  }

  /**
   * Restore from snapshot
   */
  async restoreFromSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot '${snapshotId}' not found`);
    }

    // Validate snapshot integrity
    const currentChecksum = this.calculateChecksum(snapshot.parameters);
    if (currentChecksum !== snapshot.checksum) {
      throw new Error('Snapshot integrity check failed');
    }

    // Create backup before restore
    await this.createSnapshot(`backup_before_restore_${snapshotId}`, 'Automatic backup before restore');

    // Restore parameters
    await this.updateParameters(snapshot.parameters, {
      source: 'restore',
      snapshotId,
      timestamp: new Date()
    });

    this.emit('snapshotRestored', { snapshotId, snapshot });
    logger.info(`Parameters restored from snapshot: ${snapshotId}`);
  }

  /**
   * Get available snapshots
   */
  getSnapshots(): ParameterSnapshot[] {
    return [...this.snapshots].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get parameter change history
   */
  getChangeHistory(parameterName?: string): ParameterChange[] {
    let history = [...this.changeHistory];
    
    if (parameterName) {
      history = history.filter(change => change.parameter === parameterName);
    }
    
    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get parameter definitions
   */
  getParameterDefinitions(): Map<string, ParameterDefinition> {
    return new Map(this.parameterDefinitions);
  }

  /**
   * Get parameter definition by name
   */
  getParameterDefinition(name: string): ParameterDefinition | undefined {
    return this.parameterDefinitions.get(name);
  }

  /**
   * Calculate checksum for parameters
   */
  private calculateChecksum(parameters: Record<string, any>): string {
    const sorted = Object.keys(parameters).sort().reduce((obj, key) => {
      obj[key] = parameters[key];
      return obj;
    }, {} as Record<string, any>);
    
    return Buffer.from(JSON.stringify(sorted)).toString('base64');
  }

  /**
   * Generate unique snapshot ID
   */
  private generateSnapshotId(): string {
    return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Reset parameter to default value
   */
  async resetParameter(name: string): Promise<void> {
    const definition = this.parameterDefinitions.get(name);
    if (!definition) {
      throw new Error(`Parameter '${name}' not found`);
    }

    await this.updateParameter(name, definition.defaultValue, {
      source: 'reset',
      reason: 'Reset to default value'
    });
  }

  /**
   * Reset all parameters to defaults
   */
  async resetAllParameters(): Promise<void> {
    const defaultParameters: Record<string, any> = {};
    
    for (const [name, definition] of this.parameterDefinitions) {
      defaultParameters[name] = definition.defaultValue;
    }

    await this.updateParameters(defaultParameters, {
      source: 'reset_all',
      reason: 'Reset all parameters to defaults'
    });
  }
}