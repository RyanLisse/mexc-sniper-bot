# MEXC Sniper Bot Auto Sniping Test Strategy

## Overview

This document outlines the comprehensive Test-Driven Development (TDD) strategy for the MEXC sniper bot's auto sniping functionality. The test suite covers critical gaps in the existing testing infrastructure with a focus on real-world auto sniping scenarios, edge cases, and performance optimization.

## Test Architecture

### 🎯 Testing Priorities

#### **Tier 1: Critical Auto Sniping Functionality**
- Pattern detection and trigger logic
- Entry point calculation and optimization  
- Position sizing and risk management
- Order execution and fill handling
- Emergency stop protocols

#### **Tier 2: Market Condition Handling**
- Flash crash scenarios
- Pump and dump detection
- Liquidity crisis management
- Network connectivity issues
- API rate limiting and failures

#### **Tier 3: Performance and Scalability**
- High-frequency trading scenarios
- Memory optimization
- Concurrent execution
- Load testing and stress testing

## Test Suite Components

### 1. Core Auto Sniping Tests (`tests/auto-sniping/`)

#### **`auto-sniping-core.test.ts`**
**Purpose:** End-to-end auto sniping workflow validation

**Key Test Scenarios:**
- **Auto Sniping Trigger Detection**
  - Ready state pattern detection (sts:2, st:2, tt:4)
  - Advance launch opportunity scheduling (3.5+ hour notice)
  - Confidence threshold validation and rejection logic

- **Entry Point Calculation**
  - Optimal entry price calculation for new listings
  - Market volatility adjustments
  - Insufficient liquidity handling

- **Position Sizing and Risk Management**  
  - Maximum position size enforcement
  - Portfolio risk limit validation
  - Emergency stop activation on threshold breach

- **Trade Execution Logic**
  - Multi-phase sell strategy execution
  - Partial fill handling and continuation
  - Stop loss triggering and execution

- **Error Recovery and Resilience**
  - MEXC API failure recovery with retries
  - Circuit breaker activation and handling
  - Data consistency during system failures

**Performance Requirements:**
- Pattern detection: <100ms average latency
- Order execution: <500ms average latency  
- Memory growth: <10% per hour of operation
- 99.5% uptime during normal market conditions

#### **`market-simulation-edge-cases.test.ts`**
**Purpose:** Extreme market condition testing and edge case validation

**Key Test Scenarios:**
- **Flash Crash Scenarios**
  - 20%+ rapid price decline handling
  - Emergency protocol activation
  - Stop loss execution during volatility

- **Pump and Dump Detection**
  - Manipulation pattern recognition
  - Coordinated attack detection
  - Response protocol validation

- **Network and Connectivity Issues**
  - Intermittent connection handling
  - High latency spike management
  - Order integrity during network issues

- **Exchange-Specific Quirks**
  - MEXC minimum order size compliance
  - Trading pair status change handling
  - Order book anomaly detection

- **Extreme Market Conditions**
  - Zero liquidity scenario handling
  - Extreme price gap management
  - Market maker absence detection

**Stress Test Conditions:**
- Market volatility index >90%
- Network latency >2000ms
- API error rates >20%
- Liquidity depth <10% of normal

### 2. Integration Tests (`tests/integration/`)

#### **`mexc-api-real-behavior.test.ts`**
**Purpose:** Real MEXC API integration validation and behavior testing

**Key Test Scenarios:**
- **Authentication and Security**
  - API signature generation validation
  - Authentication error handling
  - Token refresh mechanism testing

- **Market Data Accuracy**
  - Spot price consistency validation
  - Order book data integrity checking
  - Kline/candlestick data validation
  - New listing data handling

- **Rate Limiting and Performance**
  - MEXC rate limit compliance
  - Adaptive backoff implementation
  - Sustained load performance testing

- **WebSocket Integration**
  - Connection stability validation
  - Reconnection logic testing
  - Message processing performance

- **Error Handling and Recovery**
  - Common MEXC error code handling
  - Circuit breaker implementation
  - Network recovery procedures

- **Data Consistency and Validation**
  - API response schema validation
  - Cross-endpoint price consistency
  - Timestamp synchronization

**Configuration Requirements:**
```bash
# Environment variables for real API testing
ENABLE_REAL_MEXC_TESTS=true
MEXC_TEST_API_KEY=your-testnet-api-key
MEXC_TEST_SECRET_KEY=your-testnet-secret-key
MEXC_TEST_BASE_URL=https://api.mexc.com
```

### 3. Safety and Risk Management Tests (`tests/safety/`)

#### **`comprehensive-risk-management.test.ts`**
**Purpose:** Risk management system validation and safety protocol testing

**Key Test Scenarios:**
- **Portfolio Risk Limits**
  - Maximum portfolio risk percentage enforcement
  - Diversification requirement implementation
  - Real-time correlation risk monitoring

- **Position Sizing and Validation**
  - Maximum position size per trade enforcement
  - Volatility-based position adjustment
  - Stop loss placement validation

- **Emergency Protocols and Circuit Breakers**
  - Rapid portfolio decline emergency stop
  - Consecutive loss circuit breaker
  - Multi-agent safety coordination

- **Real-time Risk Monitoring**
  - Position-level risk tracking
  - Flash crash detection and response
  - Adaptive risk threshold implementation

- **Stress Testing and Edge Cases**
  - Black swan event simulation
  - Liquidity crisis handling
  - Manipulation attack detection

- **Recovery and Fail-Safe Mechanisms**
  - Graceful degradation under stress
  - System failure recovery procedures
  - Transaction integrity maintenance

**Risk Testing Thresholds:**
- Maximum portfolio risk: 20%
- Maximum position size: 10% of portfolio
- Stop loss threshold: 25% maximum
- Emergency stop delay: <1000ms
- Recovery time: <60 seconds

### 4. Performance Tests (`tests/performance/`)

#### **`high-frequency-auto-sniping.test.ts`**
**Purpose:** High-frequency trading performance validation and optimization

**Key Test Scenarios:**
- **Pattern Detection Performance**
  - Sub-100ms pattern detection latency
  - Sustained load pattern processing
  - Multi-symbol pattern detection scaling

- **Concurrent Trade Execution Performance**
  - Concurrent order placement efficiency
  - Order integrity under high concurrency
  - Memory optimization during extended sessions

- **Market Data Processing Throughput**
  - High-frequency data processing (1000+ RPS)
  - WebSocket message processing at scale
  - Queue management and backpressure handling

- **System-Wide Performance Under Load**
  - Multiple active strategy performance
  - Stress testing with circuit breaker protection
  - Scalability limits and graceful degradation

- **Real-World Performance Scenarios**
  - New listing launch simulation
  - Flash crash recovery optimization
  - Extended trading session endurance

**Performance Benchmarks:**
- Pattern detection: <100ms average, <200ms P99
- Order execution: <500ms average, <2000ms P99
- Market data processing: >1000 RPS sustained
- Memory growth: <10% per hour
- CPU usage: <80% under normal load

### 5. Test Utilities (`tests/utils/`)

#### **`auto-sniping-test-utilities.ts`**
**Purpose:** Reusable testing utilities and mock data generators

**Components:**
- **MockDataGenerator:** Realistic market data and pattern generation
- **TestFixtures:** Standard trading strategies and risk configurations
- **ApiMockingUtils:** MEXC API and database mocking utilities
- **PerformanceTestUtils:** Execution time measurement and load testing
- **RiskScenarioGenerator:** Market stress test and risk scenario creation
- **EventTestUtils:** Event-driven system testing utilities
- **AssertionHelpers:** Standardized validation functions

## Test Execution Strategy

### Running Tests

#### **Quick Test Suite (Development)**
```bash
# Run core auto sniping functionality tests
npm run test tests/auto-sniping/

# Run unit tests with new auto sniping coverage
npm run test:unit

# Run integration tests including MEXC API
npm run test:integration
```

#### **Comprehensive Test Suite (CI/CD)**
```bash
# Full test suite including performance tests
npm run test:all

# Performance and stress testing
npm run test:performance

# Real API integration tests (requires credentials)
ENABLE_REAL_MEXC_TESTS=true npm run test:integration
```

#### **Specific Test Categories**
```bash
# Auto sniping functionality only
npm run test -- --grep "Auto Sniping"

# Risk management and safety
npm run test -- --grep "Risk Management|Safety"

# Performance and scalability
npm run test -- --grep "Performance|High-Frequency"

# Market edge cases
npm run test -- --grep "Flash Crash|Pump and Dump|Edge Cases"
```

### Test Environment Configuration

#### **Development Environment**
```bash
# .env.test
NODE_ENV=test
TEST_TIMEOUT=30000
LOG_LEVEL=warn

# Database
DATABASE_URL=postgresql://test:test@localhost:5432/mexc_sniper_test

# Mock API responses
ENABLE_REAL_MEXC_TESTS=false
MEXC_TEST_API_KEY=test-api-key
MEXC_TEST_SECRET_KEY=test-secret-key
```

#### **CI/CD Environment**
```bash
# .env.ci
NODE_ENV=test
CI=true
TEST_TIMEOUT=60000
LOG_LEVEL=error

# Real API testing (optional)
ENABLE_REAL_MEXC_TESTS=${ENABLE_REAL_API_TESTS}
MEXC_TEST_API_KEY=${MEXC_TESTNET_API_KEY}
MEXC_TEST_SECRET_KEY=${MEXC_TESTNET_SECRET_KEY}

# Performance testing
ENABLE_PERFORMANCE_TESTS=true
PERFORMANCE_TEST_DURATION=30000
```

## Test Data Management

### Mock Data Strategy

#### **Pattern Detection Data**
- Ready state patterns (sts:2, st:2, tt:4)
- Various confidence level scenarios
- Activity data with different types and priorities
- Calendar entries with different advance notice periods

#### **Market Data Simulation**
- Normal market conditions (±5% volatility)
- High volatility scenarios (>50% volatility)
- Flash crash simulations (30-50% drops)
- Pump and dump patterns (200-1000% increases)
- Low liquidity conditions (<5% normal volume)

#### **Trading Scenarios**
- Conservative, moderate, and aggressive strategies
- Different portfolio sizes and risk tolerances
- Various market cap and volume profiles
- Multiple asset correlation scenarios

### Database Test Management

#### **Test Database Setup**
```bash
# Create test database
npm run db:test:create

# Run migrations
npm run db:test:migrate

# Seed test data
npm run db:test:seed

# Clean up after tests
npm run db:test:cleanup
```

#### **NeonDB Branch Testing**
```bash
# Create test branch
npm run branch:create test-auto-sniping

# Run tests against branch
DATABASE_BRANCH=test-auto-sniping npm run test

# Clean up test branch
npm run branch:delete test-auto-sniping
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Auto Sniping Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test tests/auto-sniping/

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:integration
      - run: npm run test tests/safety/
    env:
      ENABLE_REAL_MEXC_TESTS: false

  performance-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test tests/performance/
    env:
      ENABLE_PERFORMANCE_TESTS: true
```

### Pre-commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
npm run lint
npm run type-check
npm run test tests/auto-sniping/auto-sniping-core.test.ts
npm run test tests/safety/comprehensive-risk-management.test.ts
```

## Quality Metrics and Monitoring

### Coverage Requirements

#### **Code Coverage Targets**
- Auto sniping core functionality: >95%
- Risk management systems: >90%
- Pattern detection engine: >90%
- MEXC API integration: >85%
- Overall codebase: >85%

#### **Test Coverage Tracking**
```bash
# Generate coverage report
npm run test:coverage

# Coverage for specific components
npm run test:coverage -- tests/auto-sniping/
npm run test:coverage -- tests/safety/
npm run test:coverage -- tests/performance/
```

### Performance Monitoring

#### **Key Performance Indicators (KPIs)**
- Pattern detection latency: <100ms P95, <200ms P99
- Order execution latency: <500ms P95, <2000ms P99
- System throughput: >180 RPS sustained
- Error rate: <2% under normal load, <5% under stress
- Memory usage: <1GB peak, <10% growth per hour
- CPU usage: <80% average under load

#### **Alert Thresholds**
- Pattern detection accuracy drops below 95%
- Order execution latency exceeds 2s P99
- System error rate exceeds 5%
- Memory usage exceeds 1GB
- Test suite failure rate exceeds 10%

## Troubleshooting Guide

### Common Test Failures

#### **Pattern Detection Test Failures**
```bash
# Check for timing issues
npm run test -- --grep "pattern detection" --timeout 60000

# Verify mock data generation
npm run test -- --grep "MockDataGenerator" --verbose

# Check AI service mocks
npm run test -- --grep "AI enhancement" --debug
```

#### **Performance Test Failures**
```bash
# Run with extended timeouts
PERFORMANCE_TEST_DURATION=60000 npm run test tests/performance/

# Check memory constraints
NODE_OPTIONS="--max-old-space-size=4096" npm run test:performance

# Verify system resources
npm run test:performance -- --reporter=verbose
```

#### **API Integration Test Failures**
```bash
# Check network connectivity
npm run test -- --grep "connectivity"

# Verify API credentials
ENABLE_REAL_MEXC_TESTS=true npm run test:mexc-credentials

# Test with mock APIs only
ENABLE_REAL_MEXC_TESTS=false npm run test:integration
```

### Debug Commands

#### **Verbose Test Execution**
```bash
# Debug specific test
DEBUG=test:* npm run test -- --grep "flash crash"

# Run single test file with debug
npm run test tests/auto-sniping/auto-sniping-core.test.ts -- --reporter spec

# Generate detailed test report
npm run test -- --reporter html --outputFile test-results.html
```

#### **Performance Profiling**
```bash
# Profile memory usage
npm run test:profile-memory

# Profile CPU usage
npm run test:profile-cpu

# Generate performance report
npm run test:performance -- --reporter json --outputFile perf-results.json
```

## Best Practices

### Test Design Principles

#### **Atomic Tests**
- Each test verifies one specific behavior
- Tests are independent and can run in any order
- No shared state between tests

#### **Deterministic Tests**
- Tests produce consistent results across runs
- Use fixed seeds for random data generation
- Mock time-dependent operations

#### **Fast Feedback**
- Critical tests execute quickly (<5 seconds)
- Use parallel execution where possible
- Optimize test data and mocking

#### **Realistic Scenarios**
- Test data reflects real market conditions
- Error scenarios match actual API failures
- Performance tests use realistic loads

### Maintenance Guidelines

#### **Regular Test Review**
- Review test relevance monthly
- Update test data for market changes
- Refactor tests for maintainability
- Add tests for new edge cases discovered

#### **Performance Baseline Updates**
- Update performance thresholds quarterly
- Review and adjust based on infrastructure changes
- Document performance regression investigations
- Maintain historical performance data

#### **Documentation Updates**
- Keep test documentation current with code changes
- Document new test scenarios and their rationale
- Update troubleshooting guides based on issues encountered
- Maintain clear test categorization and tagging

## Conclusion

This comprehensive test strategy ensures the MEXC sniper bot's auto sniping functionality is thoroughly validated across all critical scenarios. The test suite provides confidence in the system's reliability, performance, and safety while enabling rapid development and deployment of new features.

The combination of unit tests, integration tests, performance tests, and real-world scenario simulations creates a robust testing foundation that supports the high-stakes environment of automated cryptocurrency trading.