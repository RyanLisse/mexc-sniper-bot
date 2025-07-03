#!/usr/bin/env tsx
/**
 * Pre-Task Memory Bank Loader
 *
 * Reads all markdown files in the `memory-bank/` directory and prints a JSON
 * object with their contents. Intended for Taskmaster pre-task hooks to load
 * project context before running tasks.
 */
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

(async () => {
  try {
    const bankDir = join(process.cwd(), 'memory-bank');
    const files = await readdir(bankDir);
    const context: Record<string, string> = {};

    await Promise.all(
      files.filter((f) => f.endsWith('.md')).map(async (file) => {
        const content = await readFile(join(bankDir, file), 'utf8');
        context[file] = content;
      })
    );

    console.log(JSON.stringify(context));
  } catch (err) {
    console.error('Failed to load Memory Bank:', err);
    process.exit(1);
  }
})();
