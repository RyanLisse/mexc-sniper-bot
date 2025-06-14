# Stagehand E2E Testing Guide

This document provides comprehensive guidance for using Stagehand for end-to-end testing in the MEXC Sniper Bot project.

## Overview

Stagehand is an AI-powered browser automation framework that uses natural language instructions to interact with web applications. Our implementation provides comprehensive E2E testing coverage for the MEXC Sniper Bot's complex AI-driven features:

- **Kinde Auth Integration**: Secure authentication flows and protected route access
- **Real-time Dashboard**: SWR data fetching, live metrics, and responsive design
- **Pattern Discovery**: AI-powered MEXC ready state pattern detection (sts:2, st:2, tt:4)
- **Agent Workflows**: Inngest workflow triggers and multi-agent coordination
- **Complete User Journeys**: End-to-end trading bot functionality validation

**Key Advantages of Stagehand:**
- Uses OpenAI GPT-4 for intelligent browser interaction
- Natural language instructions for complex UI testing
- Self-healing tests that adapt to UI changes
- Perfect for testing AI-driven features like pattern discovery

## Test Structure

```
tests/stagehand/
├── config/
│   └── test-data.ts              # Test data and fixtures
├── helpers/
│   ├── stagehand-helpers.ts      # Base Stagehand utilities
│   ├── auth-helpers.ts           # Authentication helpers
│   ├── dashboard-helpers.ts      # Dashboard-specific helpers
│   ├── pattern-helpers.ts        # Pattern discovery helpers
│   └── api-helpers.ts            # API integration helpers
├── auth/
│   ├── login-flow.spec.ts        # Login flow tests
│   └── protected-routes.spec.ts  # Protected route tests
├── dashboard/
│   └── real-time-data.spec.ts    # Real-time data tests
├── patterns/
│   └── pattern-discovery.spec.ts # Pattern discovery tests
├── api/
│   └── inngest-workflows.spec.ts # API integration tests
└── integration/
    └── complete-user-journey.spec.ts # End-to-end journey tests
```

## Configuration

### Environment Setup

**Required Environment Variables:**

All Stagehand tests require an OpenAI API key for AI-powered browser interactions:

```bash
# Required for Stagehand AI capabilities
OPENAI_API_KEY=your_openai_api_key

# Stagehand configuration (optional)
STAGEHAND_ENV=LOCAL                    # LOCAL or BROWSERBASE
STAGEHAND_HEADLESS=true               # true for CI, false for debugging
STAGEHAND_VERBOSE=false               # true for detailed logging

# Authentication (for protected route testing)
KINDE_CLIENT_ID=your_kinde_client_id
KINDE_CLIENT_SECRET=your_kinde_client_secret
KINDE_ISSUER_URL=https://your-domain.kinde.com
KINDE_SITE_URL=http://localhost:3008
KINDE_POST_LOGOUT_REDIRECT_URL=http://localhost:3008
KINDE_POST_LOGIN_REDIRECT_URL=http://localhost:3008/dashboard

# Test environment
PLAYWRIGHT_TEST=true
NODE_ENV=test
```

### Stagehand Configuration

Stagehand is configured in individual test files with optimized settings for the MEXC Sniper Bot:

```typescript
// Standard Stagehand configuration
const stagehand = new Stagehand({
  env: "LOCAL",
  headless: process.env.CI ? true : false,  // Visible browser for local debugging
  llmProvider: {
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4o-mini",               // Fast, cost-effective model
  },
  // Optimized timeouts for MEXC API responses
  actionTimeoutMs: 15000,
  retries: 2,
  // Performance optimizations
  domSettleTimeoutMs: 1000,
  debugDom: false,
});
```

**Configuration Notes:**
- Uses `gpt-4o-mini` for cost-effective and fast testing
- Headless mode in CI, visible browser for local debugging
- Extended timeouts for MEXC API and pattern analysis operations
- Retry logic for flaky network operations

## Running Tests

### Individual Test Suites

```bash
# Authentication tests
make test-stagehand-auth
npm run test:stagehand:auth

# Dashboard tests
make test-stagehand-dashboard
npm run test:stagehand:dashboard

# Pattern discovery tests
make test-stagehand-patterns
npm run test:stagehand:patterns

# API integration tests
make test-stagehand-api
npm run test:stagehand:api

# Complete integration tests
make test-stagehand-integration
npm run test:stagehand:integration
```

### All Stagehand Tests

```bash
# Run all Stagehand tests
make test-stagehand
npm run test:stagehand

# Run with UI (for debugging)
make test-stagehand-ui
npm run test:stagehand:ui

# Run in headed mode (visible browser)
make test-stagehand-headed
npm run test:stagehand:headed
```

### Complete Test Suite

```bash
# Run all tests including Stagehand
make test-all
npm run test:all
```

## Test Categories

### 1. Authentication Flow Tests

**Location**: `tests/stagehand/auth/`

**Coverage**:
- Kinde Auth login/logout flow
- Protected route access validation
- Session persistence testing
- Authentication error handling
- Mobile viewport authentication

**Key Features**:
- AI-powered form interaction
- Dynamic auth flow handling
- Cross-browser compatibility
- Error scenario testing

### 2. Dashboard Real-time Data Tests

**Location**: `tests/stagehand/dashboard/`

**Coverage**:
- SWR data fetching validation
- Real-time metric updates
- Coin calendar functionality
- Account balance display
- User menu interactions

**Key Features**:
- API mocking for consistent testing
- Performance monitoring
- Responsive design validation
- Error state handling

### 3. Pattern Discovery Tests

**Location**: `tests/stagehand/patterns/`

**Coverage**:
- Ready state pattern detection (sts:2, st:2, tt:4)
- Pattern confidence scoring
- Workflow status monitoring
- Multi-symbol analysis
- Pattern visualization

**Key Features**:
- AI-powered pattern recognition
- Workflow trigger testing
- Real-time monitoring validation
- Performance benchmarking

### 4. API Integration Tests

**Location**: `tests/stagehand/api/`

**Coverage**:
- Inngest workflow triggers
- MEXC API endpoints
- Authentication requirements
- Error handling and recovery
- Rate limiting and performance

**Key Features**:
- Comprehensive API testing
- UI-API integration validation
- Error scenario simulation
- Performance monitoring

### 5. Complete User Journey Tests

**Location**: `tests/stagehand/integration/`

**Coverage**:
- End-to-end user workflows
- Cross-section navigation
- Data consistency validation
- Performance benchmarking
- Mobile responsiveness

**Key Features**:
- Complete workflow validation
- Performance monitoring
- Error handling throughout journey
- Mobile compatibility testing

## Helper Classes

### StagehandTestHelper

Base helper class providing common functionality:

```typescript
class StagehandTestHelper {
  async navigateToPage(path: string): Promise<void>
  async setViewportSize(size: 'mobile' | 'tablet' | 'desktop'): Promise<void>
  async takeScreenshot(name: string): Promise<string>
  async observeAndAct(instruction: string): Promise<boolean>
  async extractTextContent(instruction: string, schema: z.ZodSchema): Promise<any>
  async mockApiResponse(urlPattern: string, response: any): Promise<void>
}
```

### AuthTestHelper

Authentication-specific functionality:

```typescript
class AuthTestHelper extends StagehandTestHelper {
  async login(userType: 'validUser' | 'adminUser'): Promise<boolean>
  async logout(): Promise<boolean>
  async isAuthenticated(): Promise<boolean>
  async testProtectedRoute(route: string): Promise<object>
  async testSessionPersistence(): Promise<object>
}
```

### PatternTestHelper

Pattern discovery functionality:

```typescript
class PatternTestHelper extends StagehandTestHelper {
  async triggerPatternAnalysis(symbols?: string[]): Promise<boolean>
  async waitForPatternAnalysis(): Promise<boolean>
  async extractPatternResults(): Promise<object>
  async checkReadyStatePattern(): Promise<object>
  async testPatternConfidence(): Promise<object>
}
```

## Best Practices

### 1. Test Data Management

- Use consistent test data from `test-data.ts`
- Mock API responses for reliable testing
- Clean up state between tests
- Use realistic test scenarios

### 2. Error Handling

- Always include error scenario testing
- Verify graceful degradation
- Test recovery mechanisms
- Validate user-friendly error messages

### 3. Performance Monitoring

- Set appropriate timeouts
- Monitor response times
- Test under load conditions
- Validate performance benchmarks

### 4. Debugging

- Use screenshots on test failures
- Enable verbose logging when needed
- Run tests in headed mode for debugging
- Use Playwright UI for interactive debugging

### 5. CI/CD Integration

- Configure for both local and CI environments
- Use appropriate reporters for CI
- Handle environment-specific configurations
- Maintain test stability across environments

## Troubleshooting

### Common Issues

1. **OpenAI API Key Missing**
   ```
   Error: OpenAI API key not configured
   Solution: Set OPENAI_API_KEY in .env.local
   ```

2. **Timeout Issues**
   ```
   Error: Action timeout exceeded
   Solution: Increase timeout values or check network connectivity
   ```

3. **Authentication Failures**
   ```
   Error: Could not find login button
   Solution: Verify Kinde Auth configuration and test user setup
   ```

4. **API Mocking Issues**
   ```
   Error: Mock responses not working
   Solution: Ensure clearMocks() is called in afterEach hooks
   ```

### Debug Mode

Enable debug mode for detailed logging:

```bash
STAGEHAND_VERBOSE=true STAGEHAND_DEBUG_DOM=true npm run test:stagehand:headed
```

### Performance Issues

If tests are running slowly:

1. Check network connectivity
2. Verify OpenAI API response times
3. Reduce test complexity
4. Use faster Stagehand model (gpt-4o-mini)

## Integration with Existing Tests

Stagehand tests complement the existing test infrastructure:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test component interactions
- **Playwright E2E Tests**: Test basic user flows
- **Stagehand E2E Tests**: Test complex AI-powered interactions

All test types maintain the 100% pass rate requirement and integrate with the existing make commands and CI/CD pipeline.

## Contributing

When adding new Stagehand tests:

1. Follow the established helper pattern
2. Include comprehensive error handling
3. Add appropriate documentation
4. Ensure mobile compatibility
5. Maintain performance standards
6. Include debugging capabilities

For questions or issues, refer to the main project documentation or create an issue in the project repository.
