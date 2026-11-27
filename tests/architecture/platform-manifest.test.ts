import ts from 'typescript';
import { load, type Pkg } from '../../scripts/workspace-packages';
import {
  type Context,
  type Manifest,
  manifestProblems,
  type PackageFiles,
  tsconfigPreset,
} from './platform-manifest-rules';
import { platformPackages } from './platform-sources';
import { read, trackedFiles } from './repo-files';

const KIT: Pkg = { name: '@kit/ok', dir: 'packages/platform/universal/ok', layer: 2, deps: [] };
const APP: Pkg = { name: '@vp/domain', dir: 'packages/universal/domain', layer: 2, deps: [] };
const MOVING: Pkg = {
  name: '@kit/result',
  dir: 'packages/platform/universal/result',
  layer: 1,
  deps: [],
};

const CONTEXT: Context = {
  byName: new Map([KIT, APP, MOVING].map((pkg) => [pkg.name, pkg])),
  preset: '@kit/tsconfig',
};

const GOOD: PackageFiles = {
  pkg: KIT,
  manifest: {
    name: '@kit/ok',
    version: '0.1.0',
    type: 'module',
    types: './dist/index.d.ts',
    sideEffects: false,
    exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' } },
    dependencies: { '@kit/result': 'workspace:*' },
    peerDependencies: { zod: '^4.0.0' },
    devDependencies: { typescript: '^6.0.3' },
  },
  files: new Set(['README.md', 'AGENTS.md', 'api/ok.api.txt']),
  changelog: '# Changelog\n\n## 0.1.0\n\n- First release.\n',
  tsconfigs: {
    'tsconfig.json': { extends: '@kit/tsconfig/universal.json' },
    'tsconfig.build.json': { extends: ['./tsconfig.json', '@kit/tsconfig/build.json'] },
  },
};

const without = (key: keyof Manifest): PackageFiles => {
  const { [key]: _, ...manifest } = GOOD.manifest;
  return { ...GOOD, manifest };
};

describe('architecture: platform manifests', () => {
  it('passes a complete package', () => {
    expect(manifestProblems(GOOD, CONTEXT)).toEqual([]);
  });

  it.each([
    { shape: 'no name', input: without('name'), problem: 'has no name' },
    { shape: 'no version', input: without('version'), problem: 'has no semver version' },
    {
      shape: 'a version that is not semver',
      input: { ...GOOD, manifest: { ...GOOD.manifest, version: 'latest' } },
      problem: 'has no semver version',
    },
    {
      shape: 'no exports',
      input: without('exports'),
      problem: 'has no exports map with a "." entry',
    },
    {
      shape: 'an exports map without the root',
      input: { ...GOOD, manifest: { ...GOOD.manifest, exports: { './node': {} } } },
      problem: 'has no exports map with a "." entry',
    },
    { shape: 'no types', input: without('types'), problem: 'has no types entry' },
    {
      shape: 'no sideEffects',
      input: without('sideEffects'),
      problem: 'is not sideEffects: false',
    },
    {
      shape: 'sideEffects true',
      input: { ...GOOD, manifest: { ...GOOD.manifest, sideEffects: true } },
      problem: 'is not sideEffects: false',
    },
    { shape: 'no module type', input: without('type'), problem: 'is not ESM ("type": "module")' },
    {
      shape: 'no README',
      input: { ...GOOD, files: new Set(['AGENTS.md', 'api/ok.api.txt']) },
      problem: 'has no README.md',
    },
    {
      shape: 'no AGENTS',
      input: { ...GOOD, files: new Set(['README.md', 'api/ok.api.txt']) },
      problem: 'has no AGENTS.md',
    },
    {
      shape: 'no api snapshot',
      input: { ...GOOD, files: new Set(['README.md', 'AGENTS.md']) },
      problem: 'has no api/ok.api.txt',
    },
    {
      shape: 'no changelog',
      input: { ...GOOD, changelog: undefined },
      problem: 'has no CHANGELOG.md',
    },
    {
      shape: 'a changelog without the version',
      input: { ...GOOD, changelog: '## 0.0.9\n' },
      problem: 'has a CHANGELOG.md with no entry for 0.1.0',
    },
    {
      shape: 'no tsconfig',
      input: { ...GOOD, tsconfigs: {} },
      problem: 'has no tsconfig.json',
    },
    {
      shape: 'a tsconfig extending the repository base',
      input: {
        ...GOOD,
        tsconfigs: { 'tsconfig.json': { extends: '../../../../tsconfig.base.json' } },
      },
      problem:
        'tsconfig.json extends ../../../../tsconfig.base.json, not a sibling tsconfig or a @kit/tsconfig preset',
    },
    {
      shape: 'a tsconfig extending another package',
      input: { ...GOOD, tsconfigs: { 'tsconfig.json': { extends: ['@vp/domain/tsconfig.json'] } } },
      problem:
        'tsconfig.json extends @vp/domain/tsconfig.json, not a sibling tsconfig or a @kit/tsconfig preset',
    },
    {
      shape: 'a third-party runtime dependency',
      input: { ...GOOD, manifest: { ...GOOD.manifest, dependencies: { zod: '^4.0.0' } } },
      problem: 'depends at runtime on zod, which must be a peerDependency',
    },
    {
      shape: 'an app package as a dependency',
      input: {
        ...GOOD,
        manifest: { ...GOOD.manifest, dependencies: { '@vp/domain': 'workspace:*' } },
      },
      problem: 'lists the app package @vp/domain in dependencies',
    },
    {
      shape: 'an app package as a peer',
      input: {
        ...GOOD,
        manifest: { ...GOOD.manifest, peerDependencies: { '@vp/domain': 'workspace:*' } },
      },
      problem: 'lists the app package @vp/domain in peerDependencies',
    },
    {
      shape: 'an app package as a devDependency',
      input: {
        ...GOOD,
        manifest: { ...GOOD.manifest, devDependencies: { '@vp/domain': 'workspace:*' } },
      },
      problem: 'lists the app package @vp/domain in devDependencies',
    },
  ])('reports $shape', ({ input, problem }) => {
    expect(manifestProblems(input, CONTEXT)).toEqual([`@kit/ok ${problem}`]);
  });

  it('passes a package of tsconfig presets with no entry, types, api or tsconfig of its own', () => {
    const presets: PackageFiles = {
      ...GOOD,
      manifest: {
        ...GOOD.manifest,
        types: undefined,
        exports: { './base.json': './base.json', './build.json': './build.json' },
      },
      files: new Set(['README.md', 'AGENTS.md']),
      tsconfigs: {},
    };

    expect(manifestProblems(presets, CONTEXT)).toEqual([]);
  });

  it('follows @kit/tsconfig to the package package-moves.json names once that package exists', () => {
    const moves = { '@kit/tsconfig': '@kit/tsconfig' };

    expect(tsconfigPreset(moves, new Set(['@kit/tsconfig']))).toBe('@kit/tsconfig');
    expect(tsconfigPreset(moves, new Set(['@kit/tsconfig']))).toBe('@kit/tsconfig');
    expect(tsconfigPreset({}, new Set())).toBe('@kit/tsconfig');
  });

  it('holds every platform package to the manifest', () => {
    const packages = load();
    const context: Context = {
      byName: new Map(packages.map((pkg) => [pkg.name, pkg])),
      preset: tsconfigPreset(
        JSON.parse(read('scripts/package-moves.json')),
        new Set(packages.map(({ name }) => name))
      ),
    };
    const platform = platformPackages();

    expect(platform.length).toBeGreaterThan(0);
    expect(
      platform.flatMap((pkg) => {
        const own = trackedFiles(pkg.dir).map((file) => file.slice(pkg.dir.length + 1));
        const tsconfigs = Object.fromEntries(
          own
            .filter((file) => /^tsconfig[\w.-]*\.json$/.test(file))
            .map((file) => [
              file,
              ts.parseConfigFileTextToJson(file, read(`${pkg.dir}/${file}`)).config,
            ])
        );
        return manifestProblems(
          {
            pkg,
            manifest: JSON.parse(read(`${pkg.dir}/package.json`)),
            files: new Set(own),
            changelog: own.includes('CHANGELOG.md') ? read(`${pkg.dir}/CHANGELOG.md`) : undefined,
            tsconfigs,
          },
          context
        );
      })
    ).toEqual([]);
  });
});
