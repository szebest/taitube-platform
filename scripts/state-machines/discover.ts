import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';

const ROOTS = ['apps', 'packages'];
const SKIPPED = ['node_modules', 'dist', '.turbo'];
const SUFFIX = '.machine.ts';

async function walk(root: string, directory: string): Promise<string[]> {
  if (!existsSync(join(root, directory))) return [];
  const entries = await readdir(join(root, directory), { withFileTypes: true });
  const found = await Promise.all(
    entries.map(async (entry) => {
      const path = posix.join(directory, entry.name);
      if (entry.isDirectory()) return SKIPPED.includes(entry.name) ? [] : walk(root, path);
      return entry.name.endsWith(SUFFIX) ? [path] : [];
    })
  );
  return found.flat();
}

/** Every `*.machine.ts` under `apps` and `packages`, as repo-relative paths in a stable order. */
export async function findMachineFiles(root: string): Promise<string[]> {
  const found = await Promise.all(ROOTS.map((directory) => walk(root, directory)));
  return found.flat().sort();
}
