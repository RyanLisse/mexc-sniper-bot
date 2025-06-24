# Pattern-to-Database Bridge Tests

This directory contains comprehensive tests for the Pattern-to-Database Bridge service, which is the critical component that bridges the gap between pattern detection and auto-sniping execution.

## Test Architecture

### Integration Tests (`pattern-to-database-bridge.integration.test.ts`)

**Purpose:** Test the complete data flow pipeline from pattern detection events to database insertion.

**Coverage:**
- ✅ Event listener integration with PatternDetectionCore
- ✅ Pattern filtering and validation logic
- ✅ PatternMatch to database record conversion
- ✅ Database insertion with deduplication
- ✅ User preference integration
- ✅ Priority calculation based on confidence and risk
- ✅ Error handling and graceful degradation
- ✅ Complete end-to-end pipeline validation

**Key Test Scenarios:**
1. **Event Integration Tests**
   - Start/stop event listening
   - Handle pattern detection events
   - Process multiple pattern types
   - Verify database record creation

2. **Pattern Filtering Tests**
   - Confidence threshold filtering
   - Unsupported pattern type filtering
   - Risk level filtering
   - Required field validation

3. **Deduplication Tests**
   - Memory-based pattern deduplication
   - Database-level duplicate prevention
   - Handling of pending targets

4. **User Preferences Integration**
   - Position sizing from user preferences
   - Risk management configuration
   - Fallback to default values

5. **Priority Calculation Tests**
   - Confidence-based priority assignment
   - Pattern type priority adjustments
   - Risk level impact on priority

6. **User Limit Enforcement**
   - Per-user target count limits
   - Graceful handling of limit violations

7. **Error Handling Tests**
   - Invalid pattern data handling
   - Partial failure scenarios
   - Continuation with valid patterns

8. **End-to-End Pipeline Test**
   - Complete data flow validation
   - All components working together
   - Real-world scenario simulation

### Unit Tests (`pattern-to-database-bridge.unit.test.ts`)

**Purpose:** Test individual components and business logic without database dependencies.

**Coverage:**
- ✅ Configuration management and validation
- ✅ Pattern filtering algorithms
- ✅ Priority calculation logic
- ✅ Execution time calculation
- ✅ User ID mapping functionality
- ✅ Cache management
- ✅ Status reporting
- ✅ Error handling and validation

**Key Test Areas:**
1. **Configuration Management**
   - Default configuration loading
   - Configuration updates and validation
   - Invalid configuration handling

2. **Pattern Filtering Logic**
   - Confidence threshold filtering
   - Pattern type support filtering
   - Risk level filtering
   - Required field validation

3. **Priority Calculation**
   - Confidence-based priority assignment
   - Pattern type adjustments
   - Risk level adjustments
   - Priority range validation (1-10)

4. **Execution Time Calculation**
   - Immediate execution for ready_state
   - Future execution for launch_sequence
   - Default timing for pre_ready
   - Undefined for unknown patterns

5. **User ID Mapping**
   - Configured source mapping
   - Environment variable fallback
   - Default system fallback

6. **Cache Management**
   - Pattern tracking and deduplication
   - Cache statistics and reporting
   - Cache clearing functionality

## Test Utilities (`../test-utils/database-helpers.ts`)

**Database Test Helpers:**
- `createTestUser()` - Creates test users for testing
- `createTestUserPreferences()` - Sets up user preferences
- `cleanupTestData()` - Cleans up test data after tests
- `createTestSnipeTarget()` - Creates test snipe targets
- `waitForDatabase()` - Waits for async database operations
- `countRecords()` - Counts records in tables
- `createTestPatterns()` - Generates test pattern data
- `verifyPatternToRecordConversion()` - Validates conversion logic

## Running the Tests

### Prerequisites
1. Database must be running and configured
2. Test environment variables must be set
3. Database schema must be up to date

### Run Integration Tests
```bash
# Run all integration tests
npm test pattern-to-database-bridge.integration.test.ts

# Run specific test suite
npm test -- --grep "Event Integration"

# Run with verbose output
npm test -- --reporter=verbose pattern-to-database-bridge.integration.test.ts
```

### Run Unit Tests
```bash
# Run all unit tests
npm test pattern-to-database-bridge.unit.test.ts

# Run specific test category
npm test -- --grep "Configuration Management"

# Run with coverage
npm test -- --coverage pattern-to-database-bridge.unit.test.ts
```

### Run All Bridge Tests
```bash
# Run both integration and unit tests
npm test pattern-to-database-bridge

# Watch mode for development
npm test -- --watch pattern-to-database-bridge
```

## Test Data Flow Validation

The tests validate the complete data pipeline:

```
PatternDetectionCore → Event Emission → PatternToDatabaseBridge → Database snipe_targets
```

**Step-by-Step Validation:**
1. Pattern detection emits events with PatternMatch objects
2. Bridge receives and filters patterns by confidence/type/risk
3. Valid patterns are converted to database record format
4. User preferences are applied for position sizing
5. Priority is calculated based on pattern characteristics
6. Records are inserted into database with deduplication
7. Complete pipeline is verified end-to-end

## Test Coverage Goals

- **Integration Tests:** 95%+ coverage of critical data flow paths
- **Unit Tests:** 100% coverage of business logic functions
- **Error Handling:** 90%+ coverage of error scenarios
- **Configuration:** 100% coverage of config validation

## Expected Test Results

### Integration Tests
- All pattern types are correctly processed
- Database records match pattern data exactly
- User preferences are properly applied
- Deduplication prevents duplicate records
- Error handling maintains system stability

### Unit Tests
- All business logic functions work independently
- Configuration validation catches invalid inputs
- Priority calculation follows expected rules
- Cache management operates correctly

## Debugging Test Failures

### Common Issues
1. **Database Connection Errors**
   - Verify database is running
   - Check connection string
   - Ensure test database exists

2. **Schema Mismatches**
   - Run database migrations
   - Verify schema is up to date
   - Check field name mappings

3. **Test Data Conflicts**
   - Ensure test cleanup runs properly
   - Check for leftover test data
   - Verify test isolation

### Debug Commands
```bash
# Run single test with full output
npm test -- --grep "specific test name" --verbose

# Run tests with database debugging
DEBUG=db npm test pattern-to-database-bridge

# Check test database state
npm run db:status:test
```

## Integration Points Tested

1. **Pattern Detection Integration**
   - Event emission and reception
   - Event data structure validation
   - Multiple pattern type handling

2. **Database Integration**
   - Schema compliance
   - Transaction handling
   - Constraint validation

3. **User Management Integration**
   - User preference loading
   - User ID mapping
   - Default value fallbacks

4. **Auto-Sniping Orchestrator Integration**
   - Database target consumption
   - Status updates
   - Error propagation

## Success Criteria

✅ **Critical Pipeline Working:** Pattern detection events create database records  
✅ **Data Integrity:** All pattern data is correctly converted and stored  
✅ **User Preferences:** Position sizing and risk settings are applied  
✅ **Deduplication:** No duplicate targets are created  
✅ **Error Handling:** System continues operating despite invalid patterns  
✅ **Performance:** Bridge handles high-frequency pattern events efficiently  
✅ **Configuration:** All settings can be updated without system restart  

## Next Steps After Tests Pass

1. **Production Deployment**
   - Verify all tests pass in CI/CD
   - Deploy to staging environment
   - Monitor pattern processing metrics

2. **Integration with Existing Systems**
   - Connect to live pattern detection
   - Enable auto-sniping orchestrator
   - Monitor complete data flow

3. **Performance Monitoring**
   - Set up metrics collection
   - Monitor database performance
   - Track pattern processing latency

4. **Production Validation**
   - Verify real patterns create targets
   - Confirm auto-sniping execution
   - Monitor trading performance