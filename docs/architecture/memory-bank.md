# Memory Bank System

The Memory Bank stores project knowledge for both agents and developers. It consists of several markdown files in the `memory-bank/` directory such as `projectbrief.md`, `productContext.md`, `activeContext.md`, and others.

## Pre-Task Loading

Taskmaster loads these files before each task to provide full context. Use the helper script:

```bash
bun run scripts/pre-task-load-memory.ts
```

The script outputs a JSON object of all Memory Bank files. Configure Taskmaster to run this command as a pre-task hook so every task starts with up-to-date context.

