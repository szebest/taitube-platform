import { readFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import type { Pkg } from '../../scripts/workspace-packages';
import { moduleSpecifiers, platformFiles, platformPackages } from './platform-sources';
import { read, ROOT, trackedFiles } from './repo-files';

type ExportMap = ReadonlyMap<string, readonly string[]>;

function exportedSubpaths(pkg: Pkg): string[] {
  const { exports } = JSON.parse(read(`${pkg.dir}/package.json`));
  return typeof exports === 'object' && exports !== null ? Object.keys(exports) : ['.'];
}

const patternMatches = (pattern: string, subpath: string): boolean => {
  const [head = '', tail = ''] = pattern.split('*');
  return pattern.includes('*')
    ? subpath.startsWith(head) &&
        subpath.endsWith(tail) &&
        subpath.length >= head.length + tail.length
    : subpath === pattern;
};

function deepImports(source: string, exported: ExportMap): string[] {
  if (![...exported.keys()].some((name) => source.includes(name))) return [];
  return moduleSpecifiers(source).filter((specifier) => {
    const [path = ''] = specifier.split('?');
    const [scope = '', name = '', ...rest] = path.split('/');
    const allowed = exported.get(`${scope}/${name}`);
    if (!allowed) return false;
    const subpath = rest.length === 0 ? '.' : `./${rest.join('/')}`;
    return !allowed.some((pattern) => patternMatches(pattern, subpath));
  });
}

function leavesRoot(file: string, source: string, root: string): string[] {
  return moduleSpecifiers(source).filter((specifier) => {
    if (!specifier.startsWith('.')) return false;
    const target = posix.join(dirname(file), specifier);
    return !(target === root || target.startsWith(`${root}/`));
  });
}

const FIXTURE_EXPORTS: ExportMap = new Map([
  ['@kit/di', ['.']],
  ['@kit/runtime', ['.', './node', './browser']],
  ['@kit/ui', ['.', './icons/*']],
]);

describe('architecture: platform packages are entered through their exports', () => {
  it.each([
    { shape: 'a source path', source: "import { x } from '@kit/di/src/registry';" },
    { shape: 'a dist path', source: "export * from '@kit/di/dist/index';" },
    { shape: 'a subpath the manifest does not list', source: "import('@kit/runtime/server');" },
    { shape: 'a subpath outside a pattern', source: "import '@kit/ui/icons';" },
    { shape: 'a mocked deep module', source: "vi.mock(import('@kit/runtime/src/node'));" },
    { shape: 'an unlisted subpath with a query', source: "import css from '@kit/di/x.css?url';" },
  ])('recognises $shape', ({ source }) => {
    expect(deepImports(source, FIXTURE_EXPORTS)).toHaveLength(1);
  });

  it.each([
    { shape: 'the root entry', source: "import { x } from '@kit/di';" },
    { shape: 'a listed subpath', source: "import '@kit/runtime/node';" },
    { shape: 'a subpath a pattern covers', source: "import '@kit/ui/icons/play';" },
    { shape: 'a listed subpath with a query', source: "import css from '@kit/runtime/node?url';" },
    { shape: 'a package that is not a platform package', source: "import '@vp/core/src/x';" },
    { shape: 'a path named in a string', source: "const a = '@kit/di/src/registry';" },
  ])('leaves $shape alone', ({ source }) => {
    expect(deepImports(source, FIXTURE_EXPORTS)).toEqual([]);
  });

  it.each([
    { shape: 'a sibling package', specifier: '../../di/src/registry', found: 1 },
    { shape: 'the repository root', specifier: '../../../../../tests/x', found: 1 },
    { shape: 'a re-export out of the root', source: "export * from '../../other';", found: 1 },
    { shape: 'a file inside the package', specifier: '../token', found: 0 },
    { shape: 'a package-level sibling file', specifier: '../vitest.config', found: 0 },
  ])(
    'counts $found relative import(s) leaving the root for $shape',
    ({ specifier, source, found }) => {
      const text = source ?? `import x from '${specifier}';`;

      expect(
        leavesRoot(
          'packages/platform/universal/runtime/src/a.ts',
          text,
          'packages/platform/universal/runtime'
        )
      ).toHaveLength(found);
    }
  );

  it('finds no deep import of a platform package anywhere in the repository', () => {
    const exported: ExportMap = new Map(
      platformPackages().map((pkg) => [pkg.name, exportedSubpaths(pkg)])
    );
    const files = trackedFiles('apps', 'packages', 'scripts', 'tests').filter(
      (file) => /\.tsx?$/.test(file) && !file.endsWith('.d.ts')
    );

    expect(exported.size).toBeGreaterThan(0);
    expect(
      files.flatMap((file) =>
        deepImports(readFileSync(join(ROOT, file), 'utf8'), exported).map(
          (specifier) => `${file}: ${specifier}`
        )
      )
    ).toEqual([]);
  });

  it('keeps every import of a platform package inside its root', () => {
    const packages = platformPackages();
    const found = platformFiles().flatMap((file) => {
      const pkg = packages.find(({ dir }) => file.startsWith(`${dir}/`));
      return pkg
        ? leavesRoot(file, read(file), pkg.dir).map((specifier) => `${file}: ${specifier}`)
        : [];
    });

    expect(found).toEqual([]);
  });
});
