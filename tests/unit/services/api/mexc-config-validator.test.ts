/**
 * Unit tests for MexcConfigValidator
 * Tests system readiness validation, credential validation, pattern detection, safety systems, and configuration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MexcConfigValidator,
  type ConfigValidationResult,
  type SystemReadinessReport,
} from '../../../../src/services/api/mexc-config-validator';

// Mock dependencies
vi.mock('@/src/core/pattern-detection', () => ({
  PatternDetectionCore: {
    getInstance: vi.fn(() => ({
      detectReadyStatePattern: vi.fn(),
    })),
  },
}));

vi.mock('@/src/services/risk/comprehensive-safety-coordinator', () => ({
  ComprehensiveSafetyCoordinator: vi.fn(() => ({
    getCurrentStatus: vi.fn(),
  })),
}));

vi.mock('../../../../src/services/api/unified-mexc-service-v2', () => ({
  UnifiedMexcServiceV2: vi.fn(() => ({
    hasValidCredentials: vi.fn(),
    testConnectivityWithResponse: vi.fn(),
    getServerTime: vi.fn(),
    testConnectivity: vi.fn(),
    getCircuitBreakerStatus: vi.fn(),
  })),
}));

describe('MexcConfigValidator', () => {
  let configValidator: MexcConfigValidator;
  let mockMexcService: any;
  let mockPatternEngine: any;
  let mockSafetyCoordinator: any;
  let mockConsole: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Mock console methods
    mockConsole = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    global.console.info = mockConsole.info;
    global.console.warn = mockConsole.warn;
    global.console.error = mockConsole.error;
    global.console.debug = mockConsole.debug;

    // Create mock instances
    mockMexcService = {
      hasValidCredentials: vi.fn().mockReturnValue(true),
      testConnectivityWithResponse: vi.fn(),
      getServerTime: vi.fn(),
      testConnectivity: vi.fn(),
      getCircuitBreakerStatus: vi.fn(),
    };

    mockPatternEngine = {
      detectReadyStatePattern: vi.fn(),
    };

    mockSafetyCoordinator = {
      getCurrentStatus: vi.fn(),
    };

    // Mock module dependencies
    const { UnifiedMexcServiceV2 } = require('../../../../src/services/api/unified-mexc-service-v2');
    const { PatternDetectionCore } = require('@/src/core/pattern-detection');
    const { ComprehensiveSafetyCoordinator } = require('@/src/services/risk/comprehensive-safety-coordinator');

    UnifiedMexcServiceV2.mockImplementation(() => mockMexcService);
    PatternDetectionCore.getInstance.mockReturnValue(mockPatternEngine);
    ComprehensiveSafetyCoordinator.mockImplementation(() => mockSafetyCoordinator);

    // Clear environment variables
    delete process.env.MEXC_API_KEY;
    delete process.env.MEXC_SECRET_KEY;
    delete process.env.MAX_POSITION_SIZE;
    delete process.env.MAX_PORTFOLIO_RISK;
    delete process.env.STOP_LOSS_PERCENTAGE;
    delete process.env.AUTO_SNIPING_ENABLED;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    // Reset singleton instance
    (MexcConfigValidator as any).instance = undefined;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MexcConfigValidator.getInstance();
      const instance2 = MexcConfigValidator.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(MexcConfigValidator);
    });

    it('should create instance only once', () => {
      MexcConfigValidator.getInstance();
      MexcConfigValidator.getInstance();
      MexcConfigValidator.getInstance();

      const { UnifiedMexcServiceV2 } = require('../../../../src/services/api/unified-mexc-service-v2');
      expect(UnifiedMexcServiceV2).toHaveBeenCalledTimes(1);
    });
  });

  describe('MEXC Credentials Validation', () => {
    beforeEach(() => {
      configValidator = MexcConfigValidator.getInstance();
    });

    it('should validate credentials successfully', async () => {
      process.env.MEXC_API_KEY = 'test-api-key-12345';
      process.env.MEXC_SECRET_KEY = 'test-secret-key-67890';

      mockMexcService.hasValidCredentials.mockReturnValue(true);
      mockMexcService.testConnectivityWithResponse.mockResolvedValue({
        success: true,
        data: { latency: 150 },
      });
      mockMexcService.getServerTime.mockResolvedValue({
        success: true,
        data: { serverTime: Date.now() },
      });

      const result = await configValidator.validateMexcCredentials();

      expect(result.isValid).toBe(true);
      expect(result.component).toBe('MEXC API Credentials');
      expect(result.status).toBe('valid');
      expect(result.message).toBe('MEXC API credentials validated successfully');
      expect(result.details).toMatchObject({
        responseTime: 150,
        timeDifference: expect.any(Number),
        serverTime: expect.any(Number),
      });
    });

    it('should fail when credentials are not configured', async () => {
      mockMexcService.hasValidCredentials.mockReturnValue(false);

      const result = await configValidator.validateMexcCredentials();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('MEXC API credentials not configured');
      expect(result.details).toMatchObject({
        hasApiKey: false,
        hasSecretKey: false,
        apiKeyLength: 0,
        secretKeyLength: 0,
        hasValidLength: false,
      });
    });

    it('should fail when API connectivity test fails', async () => {
      process.env.MEXC_API_KEY = 'test-api-key-12345';
      process.env.MEXC_SECRET_KEY = 'test-secret-key-67890';

      mockMexcService.hasValidCredentials.mockReturnValue(true);
      mockMexcService.testConnectivityWithResponse.mockResolvedValue({
        success: false,
        error: 'Network connection failed',
        responseTime: 5000,
      });

      const result = await configValidator.validateMexcCredentials();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('MEXC API connectivity failed');
      expect(result.details.error).toBe('Network connection failed');
    });

    it('should fail when server time sync fails', async () => {
      process.env.MEXC_API_KEY = 'test-api-key-12345';
      process.env.MEXC_SECRET_KEY = 'test-secret-key-67890';

      mockMexcService.hasValidCredentials.mockReturnValue(true);
      mockMexcService.testConnectivityWithResponse.mockResolvedValue({
        success: true,
        data: { latency: 150 },
      });
      mockMexcService.getServerTime.mockResolvedValue({
        success: false,
        error: 'Failed to get server time',
      });

      const result = await configValidator.validateMexcCredentials();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('Failed to sync with MEXC server time');
    });

    it('should warn when time synchronization is off', async () => {
      process.env.MEXC_API_KEY = 'test-api-key-12345';
      process.env.MEXC_SECRET_KEY = 'test-secret-key-67890';

      const currentTime = Date.now();
      const serverTime = currentTime - 15000; // 15 seconds difference

      mockMexcService.hasValidCredentials.mockReturnValue(true);
      mockMexcService.testConnectivityWithResponse.mockResolvedValue({
        success: true,
        data: { latency: 150 },
      });
      mockMexcService.getServerTime.mockResolvedValue({
        success: true,
        data: { serverTime },
      });

      const result = await configValidator.validateMexcCredentials();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('warning');
      expect(result.message).toBe('Server time synchronization issue detected');
      expect(result.details.timeDifference).toBeGreaterThan(10000);
    });

    it('should handle connectivity test timeout', async () => {
      process.env.MEXC_API_KEY = 'test-api-key-12345';
      process.env.MEXC_SECRET_KEY = 'test-secret-key-67890';

      mockMexcService.hasValidCredentials.mockReturnValue(true);
      
      // Mock a hanging promise that doesn't resolve
      mockMexcService.testConnectivityWithResponse.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const promise = configValidator.validateMexcCredentials();
      
      // Advance time to trigger timeout
      vi.advanceTimersByTime(10000);
      
      const result = await promise;

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('MEXC API connectivity failed');
      expect(result.details.error).toBe('Connectivity test timeout after 10 seconds');
    });

    it('should handle server time check timeout', async () => {
      process.env.MEXC_API_KEY = 'test-api-key-12345';
      process.env.MEXC_SECRET_KEY = 'test-secret-key-67890';

      mockMexcService.hasValidCredentials.mockReturnValue(true);
      mockMexcService.testConnectivityWithResponse.mockResolvedValue({
        success: true,
        data: { latency: 150 },
      });
      
      // Mock a hanging promise for server time
      mockMexcService.getServerTime.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const promise = configValidator.validateMexcCredentials();
      
      // Advance time to trigger timeout
      vi.advanceTimersByTime(8000);
      
      const result = await promise;

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('Failed to sync with MEXC server time');
    });

    it('should handle validation errors gracefully', async () => {
      mockMexcService.hasValidCredentials.mockThrowError(new Error('Credential check failed'));

      const result = await configValidator.validateMexcCredentials();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('MEXC API validation failed');
      expect(result.details.error).toBe('Credential check failed');
    });
  });

  describe('Pattern Detection Validation', () => {
    beforeEach(() => {
      configValidator = MexcConfigValidator.getInstance();
    });

    it('should validate pattern detection successfully', async () => {
      mockPatternEngine.detectReadyStatePattern.mockResolvedValue([
        { pattern: 'ready_state', confidence: 0.85 }
      ]);

      const result = await configValidator.validatePatternDetection();

      expect(result.isValid).toBe(true);
      expect(result.component).toBe('Pattern Detection Engine');
      expect(result.status).toBe('valid');
      expect(result.message).toBe('Pattern detection engine operational');
      expect(result.details.aiServicesAvailable).toEqual({
        cohereEmbedding: true,
        perplexityInsights: true,
      });
      expect(mockPatternEngine.detectReadyStatePattern).toHaveBeenCalledWith({
        cd: 'BTCUSDT',
        symbol: 'BTCUSDT',
        sts: 2,
        st: 2,
        tt: 4,
        ca: '0x1000',
        ps: 100,
        qs: 50,
      });
    });

    it('should handle pattern detection errors', async () => {
      mockPatternEngine.detectReadyStatePattern.mockRejectedValue(
        new Error('Pattern detection failed')
      );

      const result = await configValidator.validatePatternDetection();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('Pattern detection validation failed');
      expect(result.details.error).toBe('Pattern detection failed');
    });

    it('should handle non-Error thrown values', async () => {
      mockPatternEngine.detectReadyStatePattern.mockRejectedValue('String error');

      const result = await configValidator.validatePatternDetection();

      expect(result.isValid).toBe(false);
      expect(result.details.error).toBe('Unknown error');
    });
  });

  describe('Safety Systems Validation', () => {
    beforeEach(() => {
      configValidator = MexcConfigValidator.getInstance();
    });

    it('should validate safety systems successfully', async () => {
      mockSafetyCoordinator.getCurrentStatus.mockReturnValue({
        overall: { systemStatus: 'operational' },
      });
      mockMexcService.getCircuitBreakerStatus.mockResolvedValue({
        success: true,
        data: { status: 'CLOSED' },
      });

      const result = await configValidator.validateSafetySystems();

      expect(result.isValid).toBe(true);
      expect(result.component).toBe('Safety & Risk Management');
      expect(result.status).toBe('valid');
      expect(result.message).toBe('Safety systems fully operational');
      expect(result.details.safetyStatus.overall.systemStatus).toBe('operational');
      expect(result.details.circuitBreakerStatus.status).toBe('CLOSED');
    });

    it('should fail when safety systems are not operational', async () => {
      mockSafetyCoordinator.getCurrentStatus.mockReturnValue({
        overall: { systemStatus: 'degraded' },
      });

      const result = await configValidator.validateSafetySystems();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('Safety systems not fully operational');
    });

    it('should warn when circuit breaker is open', async () => {
      mockSafetyCoordinator.getCurrentStatus.mockReturnValue({
        overall: { systemStatus: 'operational' },
      });
      mockMexcService.getCircuitBreakerStatus.mockResolvedValue({
        success: true,
        data: { status: 'OPEN' },
      });

      const result = await configValidator.validateSafetySystems();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('warning');
      expect(result.message).toBe('Circuit breaker in protective state');
    });

    it('should handle circuit breaker status failure', async () => {
      mockSafetyCoordinator.getCurrentStatus.mockReturnValue({
        overall: { systemStatus: 'operational' },
      });
      mockMexcService.getCircuitBreakerStatus.mockResolvedValue({
        success: false,
        error: 'Circuit breaker status unavailable',
      });

      const result = await configValidator.validateSafetySystems();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('warning');
      expect(result.message).toBe('Circuit breaker in protective state');
    });

    it('should handle missing safety coordinator status method', async () => {
      mockSafetyCoordinator.getCurrentStatus = undefined;

      const result = await configValidator.validateSafetySystems();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('Safety systems not fully operational');
    });

    it('should handle validation errors gracefully', async () => {
      mockSafetyCoordinator.getCurrentStatus.mockImplementation(() => {
        throw new Error('Safety system error');
      });

      const result = await configValidator.validateSafetySystems();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('Safety system validation failed');
      expect(result.details.error).toBe('Safety system error');
    });
  });

  describe('Trading Configuration Validation', () => {
    beforeEach(() => {
      configValidator = MexcConfigValidator.getInstance();
    });

    it('should validate trading configuration successfully', async () => {
      process.env.MAX_POSITION_SIZE = '0.10';
      process.env.MAX_PORTFOLIO_RISK = '0.20';
      process.env.STOP_LOSS_PERCENTAGE = '0.15';

      const result = await configValidator.validateTradingConfiguration();

      expect(result.isValid).toBe(true);
      expect(result.component).toBe('Trading Configuration');
      expect(result.status).toBe('valid');
      expect(result.message).toBe('Trading configuration validated successfully');
      expect(result.details.configuration.autoSnipingEnabled).toBe(true);
      expect(result.details.maxPositionSize).toBe(0.10);
      expect(result.details.maxPortfolioRisk).toBe(0.20);
      expect(result.details.stopLossPercentage).toBe(0.15);
    });

    it('should use default values when environment variables are not set', async () => {
      const result = await configValidator.validateTradingConfiguration();

      expect(result.isValid).toBe(true);
      expect(result.details.configuration).toMatchObject({
        maxPositionSize: '0.10',
        maxPortfolioRisk: '0.20',
        stopLossPercentage: '0.15',
        autoSnipingEnabled: true,
      });
    });

    it('should fail when position size is out of range', async () => {
      process.env.MAX_POSITION_SIZE = '0.60'; // Too high

      const result = await configValidator.validateTradingConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
      expect(result.message).toBe('Trading configuration validation failed');
      expect(result.details.issues).toContain(
        'Max position size should be between 0.01 and 0.50 (1%-50%)'
      );
    });

    it('should fail when portfolio risk is out of range', async () => {
      process.env.MAX_PORTFOLIO_RISK = '0.00'; // Too low

      const result = await configValidator.validateTradingConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.details.issues).toContain(
        'Max portfolio risk should be between 0.01 and 0.50 (1%-50%)'
      );
    });

    it('should fail when stop loss percentage is out of range', async () => {
      process.env.STOP_LOSS_PERCENTAGE = '0.35'; // Too high

      const result = await configValidator.validateTradingConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.details.issues).toContain(
        'Stop loss percentage should be between 0.01 and 0.30 (1%-30%)'
      );
    });

    it('should handle multiple configuration issues', async () => {
      process.env.MAX_POSITION_SIZE = '0.00';
      process.env.MAX_PORTFOLIO_RISK = '0.60';
      process.env.STOP_LOSS_PERCENTAGE = '0.35';

      const result = await configValidator.validateTradingConfiguration();

      expect(result.isValid).toBe(false);
      expect(result.details.issues).toHaveLength(3);
    });

    it('should handle validation errors gracefully', async () => {
      // Force a parsing error by setting invalid numeric values
      process.env.MAX_POSITION_SIZE = 'invalid';

      const result = await configValidator.validateTradingConfiguration();

      // Should still validate other parts and handle the error
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('invalid');
    });
  });

  describe('System Readiness Report', () => {
    beforeEach(() => {
      configValidator = MexcConfigValidator.getInstance();
    });

    it('should generate ready status when all validations pass', async () => {
      // Setup all validations to pass
      process.env.MEXC_API_KEY = 'test-api-key-12345';
      process.env.MEXC_SECRET_KEY = 'test-secret-key-67890';
      process.env.MAX_POSITION_SIZE = '0.10';
      process.env.MAX_PORTFOLIO_RISK = '0.20';
      process.env.STOP_LOSS_PERCENTAGE = '0.15';

      mockMexcService.hasValidCredentials.mockReturnValue(true);
      mockMexcService.testConnectivityWithResponse.mockResolvedValue({
        success: true,
        data: { latency: 150 },
      });
      mockMexcService.getServerTime.mockResolvedValue({
        success: true,
        data: { serverTime: Date.now() },
      });

      mockPatternEngine.detectReadyStatePattern.mockResolvedValue([
        { pattern: 'ready_state', confidence: 0.85 }
      ]);

      mockSafetyCoordinator.getCurrentStatus.mockReturnValue({
        overall: { systemStatus: 'operational' },
      });
      mockMexcService.getCircuitBreakerStatus.mockResolvedValue({
        success: true,
        data: { status: 'CLOSED' },
      });

      const report = await configValidator.generateSystemReadinessReport();

      expect(report.overallStatus).toBe('ready');
      expect(report.readinessScore).toBe(100);
      expect(report.validationResults).toHaveLength(4);
      expect(report.validationResults.every(r => r.isValid)).toBe(true);
      expect(report.autoSnipingEnabled).toBe(true);
      expect(report.recommendations).toContain('System ready for auto-sniping operations');
    });

    it('should generate partial status when some validations fail', async () => {
      // Setup 3 out of 4 validations to pass (75% readiness)
      process.env.MEXC_API_KEY = 'test-api-key-12345';
      process.env.MEXC_SECRET_KEY = 'test-secret-key-67890';

      mockMexcService.hasValidCredentials.mockReturnValue(true);
      mockMexcService.testConnectivityWithResponse.mockResolvedValue({
        success: true,
        data: { latency: 150 },
      });
      mockMexcService.getServerTime.mockResolvedValue({
        success: true,
        data: { serverTime: Date.now() },
      });

      mockPatternEngine.detectReadyStatePattern.mockResolvedValue([]);

      mockSafetyCoordinator.getCurrentStatus.mockReturnValue({
        overall: { systemStatus: 'operational' },
      });
      mockMexcService.getCircuitBreakerStatus.mockResolvedValue({
        success: true,
        data: { status: 'CLOSED' },
      });

      // Pattern detection will fail
      mockPatternEngine.detectReadyStatePattern.mockRejectedValue(
        new Error('Pattern detection failed')
      );

      const report = await configValidator.generateSystemReadinessReport();

      expect(report.overallStatus).toBe('partial');
      expect(report.readinessScore).toBe(75);
      expect(report.autoSnipingEnabled).toBe(false);
      expect(report.recommendations).toContain(
        'Consider enabling limited auto-sniping with reduced position sizes'
      );
    });

    it('should generate not_ready status when most validations fail', async () => {
      // Setup most validations to fail
      mockMexcService.hasValidCredentials.mockReturnValue(false);
      mockPatternEngine.detectReadyStatePattern.mockRejectedValue(
        new Error('Pattern detection failed')
      );
      mockSafetyCoordinator.getCurrentStatus.mockReturnValue({
        overall: { systemStatus: 'degraded' },
      });

      const report = await configValidator.generateSystemReadinessReport();

      expect(report.overallStatus).toBe('not_ready');
      expect(report.readinessScore).toBeLessThan(75);
      expect(report.autoSnipingEnabled).toBe(false);
      expect(report.recommendations).toContain(
        'Complete all system validations before enabling auto-sniping'
      );
    });

    it('should respect AUTO_SNIPING_ENABLED environment variable', async () => {
      // Setup all validations to pass
      process.env.MEXC_API_KEY = 'test-api-key-12345';
      process.env.MEXC_SECRET_KEY = 'test-secret-key-67890';
      process.env.AUTO_SNIPING_ENABLED = 'false';

      mockMexcService.hasValidCredentials.mockReturnValue(true);
      mockMexcService.testConnectivityWithResponse.mockResolvedValue({
        success: true,
        data: { latency: 150 },
      });
      mockMexcService.getServerTime.mockResolvedValue({
        success: true,
        data: { serverTime: Date.now() },
      });

      mockPatternEngine.detectReadyStatePattern.mockResolvedValue([]);
      mockSafetyCoordinator.getCurrentStatus.mockReturnValue({
        overall: { systemStatus: 'operational' },
      });
      mockMexcService.getCircuitBreakerStatus.mockResolvedValue({
        success: true,
        data: { status: 'CLOSED' },
      });

      const report = await configValidator.generateSystemReadinessReport();

      expect(report.overallStatus).toBe('ready');
      expect(report.autoSnipingEnabled).toBe(false); // Disabled by env var
    });

    it('should generate recommendations for failed components', async () => {
      mockMexcService.hasValidCredentials.mockReturnValue(false);
      mockPatternEngine.detectReadyStatePattern.mockRejectedValue(
        new Error('Pattern detection failed')
      );

      const report = await configValidator.generateSystemReadinessReport();

      expect(report.recommendations).toContain(
        expect.stringContaining('Fix MEXC API Credentials')
      );
      expect(report.recommendations).toContain(
        expect.stringContaining('Fix Pattern Detection Engine')
      );
    });
  });

  describe('Quick Health Check', () => {
    beforeEach(() => {
      configValidator = MexcConfigValidator.getInstance();
    });

    it('should return healthy status when all checks pass', async () => {
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.hasValidCredentials.mockReturnValue(true);

      const result = await configValidator.quickHealthCheck();

      expect(result.healthy).toBe(true);
      expect(result.score).toBe(100);
      expect(result.issues).toHaveLength(0);
    });

    it('should return unhealthy status when connectivity fails', async () => {
      mockMexcService.testConnectivity.mockResolvedValue({ 
        success: false,
        error: 'Connection failed'
      });
      mockMexcService.hasValidCredentials.mockReturnValue(true);

      const result = await configValidator.quickHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.score).toBe(75); // 100 - 1 issue * 25
      expect(result.issues).toContain('MEXC API connectivity failed');
    });

    it('should return unhealthy status when credentials are invalid', async () => {
      mockMexcService.testConnectivity.mockResolvedValue({ success: true });
      mockMexcService.hasValidCredentials.mockReturnValue(false);

      const result = await configValidator.quickHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.score).toBe(75);
      expect(result.issues).toContain('MEXC API credentials not configured');
    });

    it('should handle multiple issues', async () => {
      mockMexcService.testConnectivity.mockResolvedValue({ success: false });
      mockMexcService.hasValidCredentials.mockReturnValue(false);

      const result = await configValidator.quickHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.score).toBe(50); // 100 - 2 issues * 25
      expect(result.issues).toHaveLength(2);
    });

    it('should handle health check errors gracefully', async () => {
      mockMexcService.testConnectivity.mockRejectedValue(new Error('Service unavailable'));

      const result = await configValidator.quickHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toContain(
        'Health check failed: Service unavailable'
      );
    });

    it('should handle non-Error thrown values', async () => {
      mockMexcService.testConnectivity.mockRejectedValue('String error');

      const result = await configValidator.quickHealthCheck();

      expect(result.healthy).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toContain(
        'Health check failed: Unknown error'
      );
    });
  });
});