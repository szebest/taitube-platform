import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Pkg } from '../check-boundaries';
import { renderPackageMap, run } from '../gen-package-map';

const MAP = 'docs/package-map.md';

const MANIFESTS = {
  'packages/universal/result': { name: '@vp/result', vp: { layer: 1 } },
  'apps/server/api': {
    name: '@vp/api',
    vp: { layer: 6 },
    dependencies: { '@vp/result': 'workspace:*', zod: '^4.0.0' },
  },
};

function tree(): string {
  const root = mkdtempSync(join(tmpdir(), 'gen-package-map-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'));
  for (const [dir, manifest] of Object.entries(MANIFESTS)) {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, 'package.json'), JSON.stringify(manifest));
  }
  return root;
}

describe('scripts: pnpm gen:package-map', () => {
  it('lists each package by layer then directory, with its tier and workspace edges', () => {
    const packages: Pkg[] = [
      { name: '@vp/web', dir: 'apps/client/web', layer: 6, deps: [{ name: '@vp/ui', dev: false }] },
      {
        name: '@vp/ui',
        dir: 'packages/client/ui',
        layer: 3,
        deps: [
          { name: '@vp/result', dev: false },
          { name: '@vp/design-tokens', dev: false },
          { name: '@vp/tsconfig', dev: true },
        ],
      },
      { name: '@vp/api', dir: 'apps/server/api', layer: 6, deps: [] },
    ];

    expect(renderPackageMap(packages).split('\n').slice(-4)).toEqual([
      '| `@vp/ui` | `packages/client/ui` | client | T3 | `@vp/design-tokens`, `@vp/result` | `@vp/tsconfig` |',
      '| `@vp/web` | `apps/client/web` | client | T6 | `@vp/ui` | - |',
      '| `@vp/api` | `apps/server/api` | server | T6 | - | - |',
      '',
    ]);
  });

  it('writes the file the check reads, and the check names the file edited by hand', () => {
    const root = tree();

    expect(run([root], '/nowhere')).toEqual({ code: 0, stdout: `wrote ${MAP}\n`, stderr: '' });
    expect(run(['--check', root], '/nowhere')).toMatchObject({ code: 0 });

    writeFileSync(join(root, MAP), `${readFileSync(join(root, MAP), 'utf8')}by hand\n`);

    expect(run(['--check', root], '/nowhere')).toEqual({
      code: 1,
      stdout: '',
      stderr: `gen:package-map: ${MAP} is stale; run pnpm gen:package-map and commit it\n`,
    });
  });

  it.each([
    { argv: ['--help'], code: 0 },
    { argv: ['--wat'], code: 2 },
  ])('exits $code for $argv', ({ argv, code }) => {
    expect(run(argv, '/nowhere').code).toBe(code);
  });
});
