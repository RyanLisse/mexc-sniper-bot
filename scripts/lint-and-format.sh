#!/bin/bash
# Unified linting and formatting script for Python and TypeScript/JavaScript

echo "🧹 Running unified linting and formatting..."

# Run Ruff for Python
echo ""
echo "🐍 Python (Ruff):"
echo "=================="
echo "Checking Python code..."
uv run ruff check --fix
echo "Formatting Python code..."
uv run ruff format

# Run Biome for TypeScript/JavaScript
echo ""
echo "📦 TypeScript/JavaScript (Biome):"
echo "================================="
echo "Checking and formatting TypeScript/JavaScript code..."
bun run lint

# Run ty for Python type checking (if available)
echo ""
echo "🔍 Python Type Checking (ty):"
echo "============================="
if command -v uvx &> /dev/null; then
    uvx ty check --color=auto || echo "⚠️  ty is in preview and may have issues"
else
    echo "⚠️  uvx not found, skipping ty type checking"
fi

echo ""
echo "✅ Linting and formatting complete!"