#!/bin/bash

# Run only unit tests, excluding E2E tests completely
echo "Running unit tests only..."

# Use vitest directly to avoid conflicts
npx vitest run

echo "Unit tests completed."