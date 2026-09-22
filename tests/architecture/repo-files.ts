import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');

const SOURCE_ROOTS = ['apps', 'packages', 'scripts'];

export function trackedFiles(...pathspecs: string[]): string[] {
  const stdout = execFileSync('git', ['ls-files', '-z', '--', ...pathspecs], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  return stdout.split('\0').filter(Boolean);
}

export function isSpec(file: string): boolean {
  return /\.test\.tsx?$/.test(file);
}

export function productionSources(): string[] {
  return trackedFiles(...SOURCE_ROOTS)
    .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts'))
    .filter((file) => !isSpec(file))
    .filter((file) => !/\/__(tests|mocks)__\//.test(file));
}

export function read(file: string): string {
  return readFileSync(join(ROOT, file), 'utf8');
}

export function shrinkOnly(offenders: string[], allowed: readonly string[]) {
  return {
    unlisted: offenders.filter((file) => !allowed.includes(file)),
    stale: allowed.filter((file) => !offenders.includes(file)),
  };
}
