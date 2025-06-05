# OpenAI Codex Integration for MEXC Sniper Bot

This directory contains configuration files and scripts for integrating OpenAI Codex with the MEXC Sniper Bot project to enhance AI-assisted development.

## Setup

1. **Install OpenAI Python Library**
   ```bash
   pip install openai
   ```

2. **Configure API Key**
   Add your OpenAI API key to `.env`:
   ```bash
   OPENAI_API_KEY=your-api-key-here
   ```

3. **Run Setup Script**
   ```bash
   python .codex/setup.py
   ```

## Files Generated

### `context.json`
Contains project context including:
- Architecture overview (FastAPI + Next.js)
- Key components and their purposes
- Coding patterns and best practices
- AI trading concepts and technical indicators

### `file_index.json`
Comprehensive index of project files:
- File paths and types
- File descriptions and purposes
- Project structure mapping

### `prompts.json`
Pre-configured prompts for common development tasks:
- Creating trading agents
- Building React components
- Adding API endpoints
- Defining database models

## Usage with Codex

### 1. Enhanced Code Completion
The context files help Codex understand:
- Project structure and dependencies
- Existing patterns and conventions
- Domain-specific trading terminology
- Component relationships

### 2. Intelligent Code Generation
Use the predefined prompts for:
```python
# Example: Generate a new trading strategy
from openai import OpenAI

client = OpenAI()

response = client.completions.create(
    model="text-davinci-codex",
    prompt=f"{context['trading_agent']['prompt']}\n\n# Context: {context['trading_agent']['context']}",
    max_tokens=500,
    temperature=0.1
)
```

### 3. Code Explanation and Documentation
Codex can explain existing code with project context:
```python
# Explain complex trading logic
response = client.completions.create(
    model="text-davinci-codex",
    prompt=f"Explain this trading code:\n{code_snippet}\n\nProject context: {context}",
    max_tokens=300
)
```

## Integration Examples

### Trading Agent Development
```python
# Use Codex to generate a new pattern detection agent
prompt = """
Create a trading agent that monitors MEXC symbolsV2 API for pattern changes.
The agent should:
1. Inherit from the base Agent class
2. Use async methods for API calls
3. Implement caching with Valkey
4. Log pattern state changes
5. Follow the existing code patterns in api/agents.py
"""
```

### React Component Creation
```typescript
// Generate shadcn/ui components for trading interface
const prompt = `
Create a React component for displaying trading signals using:
- shadcn/ui Card components
- TypeScript interfaces
- Real-time data updates
- Loading and error states
- Responsive design patterns from existing components
`;
```

### API Endpoint Development
```python
# Generate FastAPI endpoints with proper patterns
prompt = """
Create a FastAPI endpoint for:
- Endpoint: POST /api/trading/execute
- Purpose: Execute trading orders
- Requirements: Pydantic models, async operation, error handling
- Pattern: Follow api/agents.py structure
"""
```

## Best Practices

1. **Context Awareness**: Always include relevant project context in prompts
2. **Pattern Consistency**: Reference existing code patterns and conventions
3. **Type Safety**: Ensure generated code includes proper type annotations
4. **Error Handling**: Include robust error handling in generated code
5. **Documentation**: Generate code with comprehensive docstrings

## Updating Context

Run the setup script regularly to update context files:
```bash
python .codex/setup.py
```

This ensures Codex has the latest project structure and patterns.

## Troubleshooting

### Common Issues

1. **API Key Not Found**
   - Ensure `OPENAI_API_KEY` is set in `.env`
   - Verify the key has Codex access

2. **Context Too Large**
   - The setup script filters relevant files
   - Exclude directories are configured to reduce context size

3. **Model Availability**
   - Codex models may have different availability
   - Check OpenAI documentation for current model names

### Support

For issues with Codex integration:
1. Check the OpenAI API status
2. Verify your API quota and usage
3. Review the generated context files for accuracy
4. Update the setup script if project structure changes significantly