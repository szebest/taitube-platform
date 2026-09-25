import { read, trackedFiles } from './repo-files';
import { violations } from './spec-discipline-rules';

/** The e2e runners poll a deployed stack on its own clock, so only the e2e specs are read. */
const SPEC_FILES = [
  ':(glob)apps/**/*.test.ts',
  ':(glob)apps/**/*.test.tsx',
  ':(glob)apps/**/__tests__/**/*.ts',
  ':(glob)apps/**/__tests__/**/*.tsx',
  ':(glob)packages/**/*.test.ts',
  ':(glob)packages/**/*.test.tsx',
  ':(glob)packages/**/__tests__/**/*.ts',
  ':(glob)tests/architecture/**/*.ts',
  ':(glob)tests/in-process/**/*.ts',
  ':(glob)tests/**/*.test.ts',
];

function ruleNames(source: string): string[] {
  return violations('fixture.test.ts', source).map((found) => found.split(': ')[1] ?? '');
}

describe('architecture: spec discipline', () => {
  it.each([
    ["import { describe, expect } from 'vitest';", 'imports a runtime value from vitest'],
    ["import * as v from 'vitest';", 'imports a runtime value from vitest'],
    ['await new Promise((resolve) => setTimeout(resolve, 20));', 'waits on a timer'],
    ['await new Promise((resolve) => setImmediate(resolve));', 'waits on a timer'],
    ['await new Promise(setImmediate);', 'waits on a timer'],
    ["import { setTimeout } from 'node:timers/promises';", 'imports a timer to wait on'],
    ["import { scheduler } from 'timers/promises';", 'imports a timer to wait on'],
    [
      "const { setTimeout: wait } = await import('node:timers/promises');",
      'imports a timer to wait on',
    ],
    ['await new Promise((r) => globalThis.setTimeout(r, 20));', 'waits on a timer'],
    ['await new Promise(globalThis.setImmediate);', 'waits on a timer'],
    ['const settle = () => Promise.resolve();', 'declares a sleep helper'],
    ['async function sleep(ms: number) {}', 'declares a sleep helper'],
    [
      'const start = Date.now(); await run(); expect(Date.now() - start).toBeLessThan(50);',
      'reads elapsed wall-clock time',
    ],
    [
      'const t0 = performance.now(); expect(performance.now() - t0).toBeGreaterThan(1);',
      'reads elapsed wall-clock time',
    ],
    ["type M = typeof import('./module');", 'types a module import'],
    ['const real = await importOriginal<Module>();', 'types a module import'],
    ["it('does a thing', () => {}); it('does a thing', () => {});", 'repeats a test title'],
    ["describe('a', () => { it('x', () => {}); it('x', () => {}); });", 'repeats a test title'],
    ["console.log('here');", 'logs to the console'],
    ["it.skip('later', () => {});", 'skips or narrows the run'],
    ["describe.only('focus', () => {});", 'skips or narrows the run'],
    ["it.todo('someday');", 'skips or narrows the run'],
    ["it.skipIf(ci)('locally', () => {});", 'skips or narrows the run'],
    ["describe.runIf(ci)('in ci', () => {});", 'skips or narrows the run'],
  ])('fires on %s', (source, rule) => {
    expect(ruleNames(source)).toEqual([rule]);
  });

  it.each([
    ["import type { Mock } from 'vitest';"],
    ["import { type Mock } from 'vitest';"],
    ["import { defineConfig } from 'vitest/config';"],
    ["const { readFile } = await import('node:fs/promises');"],
    ["if (signal === 'SIGTERM') setImmediate(handler);"],
    ['const since = new Date(Date.now() - 3_600_000);'],
    ["vi.spyOn(console, 'error');"],
    ["it.each([1, 2])('reads %s', () => {}); it('reads one', () => {});"],
    ["describe('a', () => { it('x', () => {}); }); describe('b', () => { it('y', () => {}); });"],
  ])('lets %s through', (source) => {
    expect(ruleNames(source)).toEqual([]);
  });

  it('holds every spec and test helper in the repo', () => {
    const found = trackedFiles(...SPEC_FILES).flatMap((path) => violations(path, read(path)));

    expect(found).toEqual([]);
  });
});
