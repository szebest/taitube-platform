import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { isRewritableFile, runCodemod, selectMoves } from '../rewrite-specifiers';

let root: string;

const put = (path: string, text: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'codemod-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('scripts: isRewritableFile', () => {
  it.each([
    ['packages/a/src/x.ts', true],
    ['Makefile', true],
    ['.github/workflows/ci.yml', true],
    ['docs/guide.md', true],
    ['pnpm-lock.yaml', false],
    ['scripts/package-moves.json', false],
    ['docs/tickets/170-x.md', false],
    ['packages/a/CHANGELOG.md', false],
    ['logo.png', false],
  ])('%s: %s', (path, expected) => {
    expect(isRewritableFile(path)).toBe(expected);
  });
});

describe('scripts: selectMoves', () => {
  const ALL = { '@vp/a': '@kit/a', '@vp/b': '@kit/b' };

  it.each([
    { label: 'no flag', args: [], moves: ALL },
    { label: 'one package', args: ['--packages', '@vp/b'], moves: { '@vp/b': '@kit/b' } },
    { label: 'two packages', args: ['--packages', '@vp/a,@vp/b', '--dry-run'], moves: ALL },
  ])('selects for $label', ({ args, moves }) => {
    expect(selectMoves(ALL, args)).toEqual({ ok: true, moves });
  });

  it.each([
    { label: 'an equals sign', args: ['--packages=@vp/a'], problem: 'not --packages=' },
    { label: 'no value', args: ['--packages'], problem: 'names no package' },
    { label: 'an unknown name', args: ['--packages', '@vp/a,@vp/z'], problem: 'no move for @vp/z' },
  ])('refuses $label instead of running over every move', ({ args, problem }) => {
    expect(selectMoves(ALL, args)).toEqual({
      ok: false,
      problem: expect.stringContaining(problem),
    });
  });
});

describe('scripts: runCodemod', () => {
  const moves = {
    '@vp/result': '@kit/result',
    '@vp/errors': { '.': { Failure: '@kit/errors', Code: '@vp/error-codes' } },
  };

  it('rewrites sources, manifests and configs, leaves symlinks and a dry run untouched', () => {
    put(
      'a/src/x.ts',
      `import { ok } from '@vp/result';\nimport { Failure, Code } from '@vp/errors';\n`
    );
    put(
      'a/package.json',
      `${JSON.stringify({ dependencies: { '@vp/a': '1', '@vp/result': 'workspace:*' } }, null, 2)}\n`
    );
    put('real.md', 'uses @vp/result');
    symlinkSync(join(root, 'real.md'), join(root, 'CLAUDE.md'));
    const files = ['a/src/x.ts', 'a/package.json', 'CLAUDE.md'];

    const dry = runCodemod({ root, moves, dirMoves: {}, files, write: false });
    expect(dry.changed).toEqual(['a/src/x.ts', 'a/package.json']);
    expect(readFileSync(join(root, 'a/src/x.ts'), 'utf8')).toContain('@vp/result');

    runCodemod({ root, moves, dirMoves: {}, files, write: true });
    expect(readFileSync(join(root, 'a/src/x.ts'), 'utf8')).toBe(
      `import { ok } from '@kit/result';\nimport { Failure } from '@kit/errors';\nimport { Code } from '@vp/error-codes';\n`
    );
    expect(JSON.parse(readFileSync(join(root, 'a/package.json'), 'utf8')).dependencies).toEqual({
      '@kit/result': 'workspace:*',
      '@vp/a': '1',
    });
    expect(readFileSync(join(root, 'real.md'), 'utf8')).toBe('uses @vp/result');
  });

  it('reports a specifier it cannot split', () => {
    put('a.ts', `import * as e from '@vp/errors';\n`);

    expect(
      runCodemod({ root, moves, dirMoves: {}, files: ['a.ts'], write: false }).problems
    ).toHaveLength(1);
  });
});
