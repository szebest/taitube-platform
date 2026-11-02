import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '../..');

const hunt = (failed: boolean) => {
  const file = join(mkdtempSync(join(tmpdir(), 'flake-hunt-')), 'report.json');
  const status = failed ? 'failed' : 'passed';
  writeFileSync(
    file,
    JSON.stringify({
      testResults: [{ name: join(REPO, 'apps/client/web/src/a.dom.test.tsx'), status }],
    })
  );
  return () =>
    execFileSync('pnpm', ['exec', 'tsx', join(REPO, 'scripts/flake-hunt.ts'), file], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
};

describe('pnpm flake-hunt', () => {
  it('passes a hunt where every spec passed', () => {
    expect(hunt(false)()).toBe('');
  });

  it('fails on a flaky spec tests/quarantine.json does not list, naming it', () => {
    expect(hunt(true)).toThrow(/flaky specs are not in tests\/quarantine.json/);
  });
});
