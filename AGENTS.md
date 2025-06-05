# AGENTS.md

## Build/Lint/Test Commands

**Python:**
- Run single test: `pytest tests/test_file.py::test_function`
- All tests: `pytest` or `pytest --cov=src`
- Lint: `uv run ruff check` | Format: `uv run ruff format`
- Type check: `uvx ty check` or `pyright`

**TypeScript:**
- Lint: `bun run lint` | Type check: `bun run type-check`
- Build: `bun run build` | Dev: `bun run dev`

**All:** `bun run pre-commit` (runs all linting and type checking)

## Code Style Guidelines

**Python:**
- Line length: 120 chars, double quotes, snake_case
- Imports: Use isort organization (`from src.module import Class`)
- Types: Use modern syntax (`list[str]` over `List[str]` where compatible)
- Errors: Use specific exception types, avoid bare `except:`
- Use `uv` and `bun` for package management

**TypeScript:**
- Line width: 100 chars, double quotes, semicolons required
- Indent: 2 spaces, camelCase for variables/functions
- Imports: Organize with Biome (`@/components` for local imports)
- Types: Prefer interfaces over types, avoid `any`, use strict mode
