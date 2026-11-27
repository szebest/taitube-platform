import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { checkPlatformChanges, isHigher, run, type Changes } from '../check-platform-changes';
import type { Pkg } from '../workspace-packages';

const DI: Pkg = { name: '@kit/di', dir: 'packages/platform/universal/di', layer: 2, deps: [] };
const APP: Pkg = { name: '@vp/domain', dir: 'packages/universal/domain', layer: 2, deps: [] };
const API = `${DI.dir}/api/di.api.txt`;

const manifest = (version: string) => JSON.stringify({ name: '@kit/di', version });

function changes(overrides: { changed: string[]; base?: string; head?: string }): Changes {
  const files: Record<string, string | undefined> = {};
  return {
    changed: overrides.changed,
    atBase: (path) => (path === `${DI.dir}/package.json` ? overrides.base : files[path]),
    atHead: (path) => (path === `${DI.dir}/package.json` ? overrides.head : files[path]),
  };
}

describe('scripts: pnpm check:platform-changes', () => {
  it.each([
    {
      shape: 'a snapshot changed with neither changelog nor version',
      input: changes({ changed: [API], base: manifest('0.1.0'), head: manifest('0.1.0') }),
      problems: [
        '@kit/di: its API snapshot changed but CHANGELOG.md did not',
        '@kit/di: its API snapshot changed but version is still 0.1.0',
      ],
    },
    {
      shape: 'a snapshot changed with a changelog but no bump',
      input: changes({
        changed: [API, `${DI.dir}/CHANGELOG.md`],
        base: manifest('0.1.0'),
        head: manifest('0.1.0'),
      }),
      problems: ['@kit/di: its API snapshot changed but version is still 0.1.0'],
    },
    {
      shape: 'a snapshot changed with a bump but no changelog',
      input: changes({ changed: [API], base: manifest('0.1.0'), head: manifest('0.2.0') }),
      problems: ['@kit/di: its API snapshot changed but CHANGELOG.md did not'],
    },
    {
      shape: 'a snapshot changed with a lower version',
      input: changes({
        changed: [API, `${DI.dir}/CHANGELOG.md`],
        base: manifest('1.0.0'),
        head: manifest('0.9.0'),
      }),
      problems: ['@kit/di: its API snapshot changed but version is still 1.0.0'],
    },
  ])('fails $shape', ({ input, problems }) => {
    expect(checkPlatformChanges([DI, APP], input)).toEqual(problems);
  });

  it.each([
    {
      shape: 'a snapshot, a changelog and a bump',
      input: changes({
        changed: [API, `${DI.dir}/CHANGELOG.md`, `${DI.dir}/package.json`],
        base: manifest('0.1.0'),
        head: manifest('0.1.1'),
      }),
    },
    {
      shape: 'a source change that leaves the snapshot alone',
      input: changes({
        changed: [`${DI.dir}/src/registry.ts`],
        base: manifest('0.1.0'),
        head: manifest('0.1.0'),
      }),
    },
    {
      shape: 'a package that is new, so nothing was released before',
      input: changes({ changed: [API], base: undefined, head: manifest('0.1.0') }),
    },
    {
      shape: 'an app package snapshot-shaped file',
      input: changes({
        changed: [`${APP.dir}/api/domain.api.txt`],
        base: manifest('0.1.0'),
        head: manifest('0.1.0'),
      }),
    },
  ])('passes $shape', ({ input }) => {
    expect(checkPlatformChanges([DI, APP], input)).toEqual([]);
  });

  it.each([
    { next: '0.2.0', previous: '0.1.9', higher: true },
    { next: '0.10.0', previous: '0.9.0', higher: true },
    { next: '1.0.0', previous: '0.99.99', higher: true },
    { next: '0.1.0', previous: '0.1.0', higher: false },
    { next: '0.1.0', previous: '0.1.1', higher: false },
    { next: '0.1.0', previous: '0.1.0-rc.1', higher: false },
  ])('reads $next as higher than $previous: $higher', ({ next, previous, higher }) => {
    expect(isHigher(next, previous)).toBe(higher);
  });

  it.each([
    { argv: ['--help'], code: 0 },
    { argv: ['--wat'], code: 2 },
    { argv: ['--base'], code: 2 },
    { argv: ['--base', 'no-such-ref-anywhere'], code: 2 },
  ])('exits $code for $argv', ({ argv, code }) => {
    expect(run(argv, '/nowhere').code).toBe(code);
  });

  it('reads the base, the head and the paths between them from git', () => {
    const root = mkdtempSync(join(tmpdir(), 'check-platform-changes-'));
    onTestFinished(() => rmSync(root, { recursive: true, force: true }));
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: root });
    const commit = (files: Record<string, string>) => {
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), text);
      }
      git('add', '-A');
      git('commit', '-m', 'step');
    };
    git('init', '-q');
    commit({
      [`${DI.dir}/package.json`]: JSON.stringify({
        name: '@kit/di',
        version: '0.1.0',
        vp: { layer: 2 },
      }),
      [API]: 'one\n',
    });
    commit({ [API]: 'two\n' });

    expect(run(['--base', 'HEAD~1'], root).code).toBe(1);

    commit({
      [API]: 'three\n',
      [`${DI.dir}/CHANGELOG.md`]: '## 0.2.0\n',
      [`${DI.dir}/package.json`]: JSON.stringify({
        name: '@kit/di',
        version: '0.2.0',
        vp: { layer: 2 },
      }),
    });

    expect(run(['--base', 'HEAD~2'], root)).toMatchObject({ code: 0, stderr: '' });
  });
});
