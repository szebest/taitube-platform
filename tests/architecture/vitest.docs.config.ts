import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const HERE = import.meta.dirname;

/** The assertions over documents: every one that imports the markdown reader. */
export const DOCUMENT_ASSERTIONS = readdirSync(HERE)
  .filter((file) => file.endsWith('.test.ts'))
  .filter((file) => readFileSync(`${HERE}/${file}`, 'utf8').includes("from './markdown'"));

/**
 * A third lane beside the AST thread and the typed fork. `vmForks` because a project on the
 * `threads` or `forks` pool would queue behind the other lane's single worker; these import no
 * TypeScript, so the extra process costs a Node start and nothing more.
 */
export default defineConfig({
  test: {
    name: 'architecture-docs',
    globals: true,
    environment: 'node',
    include: DOCUMENT_ASSERTIONS,
    testTimeout: 30_000,
    pool: 'vmForks',
    poolOptions: { vmForks: { singleFork: true } },
  },
});
