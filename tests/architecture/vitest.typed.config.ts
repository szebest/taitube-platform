import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { sourceAliases } from './workspace-sources';

const HERE = import.meta.dirname;

const importing = (module: string) =>
  readdirSync(HERE)
    .filter((file) => file.endsWith('.test.ts'))
    .filter((file) => readFileSync(`${HERE}/${file}`, 'utf8').includes(`from './${module}'`));

/**
 * The assertions that ask the type checker (every one that imports the shared `ts.Program`), and
 * the ones over documents, which parse no TypeScript: they even the two lanes out, since the AST
 * thread is the longer one without them.
 */
export const FORK_ASSERTIONS = [...importing('program'), ...importing('markdown')];

/**
 * One process with modules kept between files, so the program is built and checked once and
 * each assertion after the first reads types the checker already resolved.
 */
export default defineConfig({
  resolve: { alias: sourceAliases() },
  test: {
    name: 'architecture-typed',
    globals: true,
    environment: 'node',
    include: FORK_ASSERTIONS,
    testTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true, isolate: false } },
  },
});
