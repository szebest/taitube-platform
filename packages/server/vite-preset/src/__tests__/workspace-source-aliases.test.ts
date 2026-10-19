import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workspaceSourceAliases } from '../client-app-config';

const PACKAGES = fileURLToPath(new URL('../../../..', import.meta.url));

type Fixture = {
  name: string;
  src?: boolean;
  exports: Record<string, string>;
  files?: string[];
};

function packagesWith({ name, src = true, exports, files = [] }: Fixture): string {
  const packages = mkdtempSync(join(tmpdir(), 'vite-preset-'));
  const packageDir = join(packages, 'universal', name.replace('@vp/', ''));
  mkdirSync(join(packages, 'client'));
  mkdirSync(src ? join(packageDir, 'src') : packageDir, { recursive: true });
  const manifest = {
    name,
    exports: Object.fromEntries(Object.entries(exports).map(([k, v]) => [k, { import: v }])),
  };
  writeFileSync(join(packageDir, 'package.json'), JSON.stringify(manifest));
  for (const file of files) {
    mkdirSync(dirname(join(packageDir, file)), { recursive: true });
    writeFileSync(join(packageDir, file), '');
  }
  return packages;
}

const fixture = (exports: Record<string, string>, files: string[] = []) =>
  packagesWith({ name: '@vp/fixture', exports, files });

function resolveSpecifier(packages: string, specifier: string): string | undefined {
  const alias = workspaceSourceAliases(packages).find(({ find }) => find.test(specifier));
  return alias && specifier.replace(alias.find, alias.replacement);
}

type Resolution = Record<'label' | 'specifier' | 'source', string> & {
  exports: Record<string, string>;
  files: string[];
};

describe('@vp/vite-preset: workspace source aliases', () => {
  it.each([
    { name: '@vp/intl-react', source: 'packages/client/intl-react/src/index.ts' },
    { name: '@vp/api-client', source: 'packages/client/api-client/src/index.ts' },
    { name: '@vp/result', source: 'packages/universal/result/src/index.ts' },
    { name: '@vp/domain/time', source: 'packages/universal/domain/src/time.ts' },
    { name: '@vp/web-testing/server', source: 'packages/client/web-testing/src/server/index.ts' },
  ])('resolves $name to its source', ({ name, source }) => {
    expect(resolveSpecifier(PACKAGES, name)?.endsWith(source)).toBe(true);
  });

  it.each([
    { label: 'an exact export', subpath: './gone', built: './dist/gone.js' },
    { label: 'a wildcard directory', subpath: './tokens/*', built: './dist/tokens/*/index.js' },
  ])(
    'refuses $label whose built file has no source, instead of reading dist',
    ({ subpath, built }) => {
      expect(() => workspaceSourceAliases(fixture({ [subpath]: built }))).toThrow(
        `@vp/fixture exports ${subpath} from ${built}, which has no source at`
      );
    }
  );

  it('skips a package whose sources another app pruned away, its manifest left', () => {
    expect(
      workspaceSourceAliases(
        packagesWith({
          name: '@vp/pruned',
          src: false,
          exports: { './gone': './dist/gone.js' },
        })
      )
    ).toEqual([]);
  });

  it.each<Resolution>([
    {
      label: 'a wildcard export with a directory capture',
      exports: { './tokens/*': './dist/tokens/*/index.js' },
      files: ['src/tokens/color/index.ts'],
      specifier: '@vp/fixture/tokens/color',
      source: 'src/tokens/color/index.ts',
    },
    {
      label: 'a wildcard export with a file capture',
      exports: { './themes/*': './dist/themes/*.js' },
      files: ['src/themes/sand.ts'],
      specifier: '@vp/fixture/themes/sand',
      source: 'src/themes/sand.ts',
    },
    {
      label: 'a wildcard export whose capture spans a slash',
      exports: { './themes/*': './dist/themes/*.js' },
      files: ['src/themes/dark/sand.ts'],
      specifier: '@vp/fixture/themes/dark/sand',
      source: 'src/themes/dark/sand.ts',
    },
    {
      label: 'a wildcard export whose target has no star: every match is that file',
      exports: { './assets/*': './dist/all.js' },
      files: ['src/all.ts'],
      specifier: '@vp/fixture/assets/logo',
      source: 'src/all.ts',
    },
    {
      label: 'a wildcard export whose target has two stars: both take the capture',
      exports: { './themes/*': './dist/*/themes/*.js' },
      files: ['src/sand/themes/sand.ts'],
      specifier: '@vp/fixture/themes/sand',
      source: 'src/sand/themes/sand.ts',
    },
    {
      label: 'an exact export declared after a wildcard that also matches it',
      exports: { './tokens/*': './dist/tokens/*.js', './tokens/color': './dist/color.js' },
      files: ['src/tokens/size.ts', 'src/color.ts'],
      specifier: '@vp/fixture/tokens/color',
      source: 'src/color.ts',
    },
    {
      label: 'the wildcard with the longer prefix, declared after a shorter one',
      exports: { './tokens/*': './dist/tokens/*.js', './tokens/color/*': './dist/color/*.js' },
      files: ['src/tokens/size.ts', 'src/color/dark.ts'],
      specifier: '@vp/fixture/tokens/color/dark',
      source: 'src/color/dark.ts',
    },
  ])('resolves $label', ({ exports, files, specifier, source }) => {
    const packages = fixture(exports, files);

    expect(resolveSpecifier(packages, specifier)).toBe(join(packages, 'universal/fixture', source));
  });

  it.each([
    { label: 'a bare specifier', specifier: '@vp/fixture' },
    { label: 'an empty capture', specifier: '@vp/fixture/tokens/' },
    { label: 'another subpath', specifier: '@vp/fixture/other/color' },
    { label: 'a types-only export', specifier: '@vp/api-contracts/openapi', inRepo: true },
    { label: 'a server package', specifier: '@vp/adapters', inRepo: true },
  ])('leaves $label to the package exports', ({ specifier, inRepo }) => {
    const packages = inRepo
      ? PACKAGES
      : fixture({ './tokens/*': './dist/tokens/*/index.js' }, ['src/tokens/color/index.ts']);

    expect(resolveSpecifier(packages, specifier)).toBeUndefined();
  });
});
