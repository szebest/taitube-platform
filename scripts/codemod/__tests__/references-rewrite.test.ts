import {
  newLocationOf,
  oldLocationOf,
  rewriteReferences,
  sortManifestDependencies,
} from '../references-rewrite';

const RULES = {
  scopeRenames: { '@vp/result': '@kit/result', '@vp/ui': '@kit/ui' },
  dirMoves: {
    'packages/universal/result': 'packages/platform/universal/result',
    'packages/client/ui': 'packages/platform/client/ui',
  },
};

describe('scripts: rewriteReferences', () => {
  it.each([
    ['a manifest edge', '"@vp/result": "workspace:*"', '"@kit/result": "workspace:*"'],
    ['a subpath', "import '@vp/ui/themes/sand'", "import '@kit/ui/themes/sand'"],
    [
      'a vite alias',
      "'@vp/result': r('packages/universal/result/src')",
      "'@kit/result': r('packages/platform/universal/result/src')",
    ],
    ['a turbo filter', '--filter=@vp/result...', '--filter=@kit/result...'],
    ['a lookalike name', '@vp/result-extra', '@vp/result-extra'],
    ['a lookalike directory', 'packages/universal/result-extra', 'packages/universal/result-extra'],
    [
      'an already moved directory',
      'packages/platform/universal/result',
      'packages/platform/universal/result',
    ],
    [
      'a docs path',
      'see `packages/client/ui/AGENTS.md`',
      'see `packages/platform/client/ui/AGENTS.md`',
    ],
  ])('rewrites %s', (_label, input, expected) => {
    expect(rewriteReferences(input, 'docs/x.md', RULES)).toBe(expected);
  });

  it.each([
    [
      'a file that did not move to a moved directory',
      'apps/a/vite.config.ts',
      "'../../packages/client/ui/src'",
      "'../../packages/platform/client/ui/src'",
    ],
    [
      'a file that did not move to something that did not either',
      'apps/a/vite.config.ts',
      "'../b/src'",
      "'../b/src'",
    ],
    [
      'a moved file to something outside',
      'packages/platform/client/ui/vitest.config.ts',
      "'../../../tests/setup.ts'",
      "'../../../../tests/setup.ts'",
    ],
    [
      'a moved file to its own tree',
      'packages/platform/client/ui/vitest.config.ts',
      "'./src/index.ts'",
      "'./src/index.ts'",
    ],
    [
      'a moved file to a sibling that moved too',
      'packages/platform/client/ui/a.ts',
      "'../../universal/result/src'",
      "'../../universal/result/src'",
    ],
  ])('fixes a relative path from %s', (_label, file, input, expected) => {
    const dirMoves = { ...RULES.dirMoves };

    expect(rewriteReferences(input, file, { scopeRenames: {}, dirMoves })).toBe(expected);
  });

  it('maps locations both ways', () => {
    expect(newLocationOf('packages/client/ui/src/a.ts', RULES.dirMoves)).toBe(
      'packages/platform/client/ui/src/a.ts'
    );
    expect(oldLocationOf('packages/platform/client/ui/src/a.ts', RULES.dirMoves)).toBe(
      'packages/client/ui/src/a.ts'
    );
    expect(newLocationOf('packages/server/x', RULES.dirMoves)).toBe('packages/server/x');
  });
});

describe('scripts: sortManifestDependencies', () => {
  const manifest = (deps: Record<string, string>) =>
    `${JSON.stringify({ name: 'm', dependencies: deps }, null, 2)}\n`;

  it('re-sorts a renamed block in a manifest that round-trips', () => {
    const before = manifest({ '@vp/a': '1', '@vp/result': 'workspace:*' });
    const after = before.replace('@vp/result', '@kit/result');

    expect(sortManifestDependencies(before, after)).toBe(
      manifest({ '@kit/result': 'workspace:*', '@vp/a': '1' })
    );
  });

  it('leaves an unchanged manifest and a hand-formatted one alone', () => {
    const handFormatted = '{ "dependencies": { "@vp/b": "1", "@kit/a": "1" } }\n';

    expect(sortManifestDependencies(handFormatted, handFormatted)).toBe(handFormatted);
    expect(sortManifestDependencies(handFormatted, `${handFormatted} `)).toBe(`${handFormatted} `);
  });
});
