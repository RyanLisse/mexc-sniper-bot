#!/bin/bash
# Unified linting and formatting script for TypeScript/JavaScript

echo "🧹 Running unified linting and formatting..."

# Run Biome for TypeScript/JavaScript
echo ""
echo "📦 TypeScript/JavaScript (Biome):"
echo "================================="
echo "Checking and formatting TypeScript/JavaScript code..."
bun run lint

echo ""
echo "✅ Linting and formatting complete!"