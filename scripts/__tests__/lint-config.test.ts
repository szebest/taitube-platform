import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const FIXTURES = 'scripts/__tests__/lint-fixtures';

function codesFor(fixture: string): string[] {
  const lint = spawnSync(
    join(ROOT, 'node_modules/.bin/vp'),
    ['lint', '-c', `${FIXTURES}/vite.config.ts`, '-f', 'json', `${FIXTURES}/${fixture}`],
    { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME } }
  );
  expect(lint.stdout, lint.stderr).toContain('"diagnostics"');
  const report = JSON.parse(lint.stdout.slice(lint.stdout.indexOf('{'))) as {
    diagnostics: { code: string }[];
  };
  return report.diagnostics.map((diagnostic) => diagnostic.code);
}

describe('lint.config', () => {
  it.each([
    ['for-in-array.ts', 'typescript(no-for-in-array)'],
    ['unused-import.ts', 'eslint(no-unused-vars)'],
    ['use-no-memo-without-reason.tsx', 'house(use-no-memo-reason)'],
    ['use-no-memo-placeholder-reason.tsx', 'house(use-no-memo-reason)'],
    ['view-transition-unguarded.ts', 'house(guard-newer-apis)'],
    ['view-transition-in-check.ts', 'house(guard-newer-apis)'],
    ['idle-callback-bare-unguarded.ts', 'house(guard-newer-apis)'],
    ['idle-callback-bare-cancel-unguarded.ts', 'house(guard-newer-apis)'],
  ])('reports %s as %s', (fixture, code) => {
    expect(codesFor(fixture)).toContain(code);
  });

  it('lets a "use no memo" stand under a real `// no-memo:` reason', () => {
    expect(codesFor('use-no-memo-with-reason.tsx')).not.toContain('house(use-no-memo-reason)');
  });

  it.each([
    'view-transition-guarded.ts',
    'view-transition-optional-call.ts',
    'idle-callback-bare-guarded.ts',
    'idle-callback-shadowed.ts',
  ])('lets %s stand: a `typeof` check, an optional call or a local binding', (fixture) => {
    expect(codesFor(fixture)).not.toContain('house(guard-newer-apis)');
  });
});
