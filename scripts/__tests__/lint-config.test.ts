import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const FIXTURES = 'scripts/__tests__/fixtures/lint';

function codesFor(fixture: string): string[] {
  const { stdout } = spawnSync(
    'pnpm',
    [
      'exec',
      'vp',
      'lint',
      '-c',
      `${FIXTURES}/vite.config.ts`,
      '-f',
      'json',
      `${FIXTURES}/${fixture}`,
    ],
    { cwd: ROOT, encoding: 'utf8' }
  );
  const report = JSON.parse(stdout.slice(stdout.indexOf('{'))) as {
    diagnostics: { code: string }[];
  };
  return report.diagnostics.map((diagnostic) => diagnostic.code);
}

describe('lint.config', () => {
  it.each([
    ['for-in-array.ts', 'typescript(no-for-in-array)'],
    ['unused-import.ts', 'eslint(no-unused-vars)'],
  ])('reports %s as %s', (fixture, code) => {
    expect(codesFor(fixture)).toContain(code);
  });
});
