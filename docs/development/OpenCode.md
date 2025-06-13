# OpenCode.md

## 1. Build, Lint & Test Commands

- **Install dependencies:**  
  `bun install` or `npm install`
- **Build:**  
  `bun run build` or `npm run build`
- **Lint & Format:**  
  `bun run lint:all` or `make lint`  
  (Runs Biome linter & formatter)
- **Type check:**  
  `bun run type-check`
- **All tests (unit + e2e):**  
  `bun run test:all` or `make test`
- **Run a single Vitest (unit) test file:**  
  `bunx vitest run path/to/myfile.test.ts`
- **Test watch/UI:**  
  `bun run test:watch` (watch), `bun run test:ui` (UI)
- **E2E tests:**  
  `bun run test:e2e`

## 2. Code Style & Guidelines

- **Formatting:**  
  Enforced by Biome: 2 spaces, double quotes, semicolons, trailing commas, LF endings.
- **Imports:**  
  Use ES6 import syntax. Group built-ins, then external, then relative.
- **Types:**  
  Always use strict TypeScript types. Avoid `any` (`noExplicitAny` warns), prefer interfaces/types, and `as const`.
- **Naming:**  
  - camelCase for vars/functions, PascalCase for types/classes/components, UPPER_CASE for constants.
- **Error Handling:**  
  Use try/catch for async; never swallow errors. Prefer explicit error propagation.
- **React:**  
  Prefer function components. Use correct prop types, hooks, and accessibility best practices.
- **No Non-null Assertions:**  
  Avoid `!`; use optional chaining (`?.`) and guards (`noNonNullAssertion` warns).
- **Keep Code Modular:**  
  Files <500 lines. One class/component per file when possible.
- **Environment/Containers:**  
  Per `.cursor/rules/windsurfrules.mdc`, always run/build/test/lint code within the Env/Container—never use global system tools or git directly.
- **Git:**  
  Git is proxied in container; do not install/assume host git presence. Agents must report how human users can check out their changes.

For new features:
- Write tests first (TDD encouraged).
- Document any API, schema, or component interfaces changed.
