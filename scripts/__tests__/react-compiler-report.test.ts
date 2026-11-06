import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { runEntrypoint } from '../../packages/server/testing/src/run-entrypoint';

const FILE = 'packages/client/demo/src/toggle.tsx';

const CONDITIONAL_HOOK = `import { useState } from 'react';
export function Toggle({ on }: { on: boolean }) {
  if (on) {
    useState(0);
  }
  return null;
}
`;

const CLEAN = `export function Toggle({ on }: { on: boolean }) {
  return on ? <p>on</p> : null;
}
`;

function report(source: string, bailouts: string[] | undefined) {
  const root = mkdtempSync(join(tmpdir(), 'react-compiler-report-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const baseline =
    bailouts === undefined ? {} : { [FILE]: { bailouts, lint: [], reason: 'r', issue: 'i' } };
  for (const [file, text] of Object.entries({
    [FILE]: source,
    'tests/react-compiler/baseline.json': JSON.stringify(baseline),
  })) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return runEntrypoint(resolve(import.meta.dirname, '../react-compiler-report.ts'), [root], {
    PATH: process.env.PATH,
  });
}

describe('scripts: react-compiler-report', () => {
  it.each([
    {
      shape: 'a bailout the baseline does not list',
      source: CONDITIONAL_HOOK,
      bailouts: undefined,
      status: 1,
      output: `${FILE}:4 Hooks:`,
    },
    {
      shape: 'a bailout the baseline lists',
      source: CONDITIONAL_HOOK,
      bailouts: ['Hooks'],
      status: 0,
      output: '1 files, every bailout in the baseline',
    },
    {
      shape: 'a baseline entry the file no longer reports',
      source: CLEAN,
      bailouts: ['Hooks'],
      status: 1,
      output: `${FILE}: Hooks no longer bails`,
    },
  ])('exits $status on $shape', ({ source, bailouts, status, output }) => {
    const { status: exit, stdout, stderr } = report(source, bailouts);

    expect(exit).toBe(status);
    expect(stdout + stderr).toContain(output);
  });
});
