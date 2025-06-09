#!/bin/bash

# Run only unit tests, excluding E2E tests completely
echo "Running unit tests only..."

# Use specific path patterns to avoid E2E test discovery
bun test \
  __tests__/unit/ \
  __tests__/integration/ \
  __tests__/utils/ \
  all-tests/vitest-unit-tests/ \
  --run \
  --config vitest.config.js

echo "Unit tests completed."