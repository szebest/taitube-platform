import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workspaceSourceAliases } from '../client-app-config';

type Fixture = {
  name: string;
  src?: boolean;
  exports: Record<string, string>;
  files?: string[];
};

function packagesWith(
  { name, src = true, exports, files = [] }: Fixture,
  tier = 'universal'
): string {
  const packages = mkdtempSync(join(tmpdir(), 'vite-preset-'));
  const packageDir = join(packages, tier, name.replace('@acme/', ''));
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
  packagesWith({ name: '@acme/fixture', exports, files });

const REPO_PACKAGES = fileURLToPath(new URL('../../../../../', import.meta.url));

function resolveSpecifier(packages: string, specifier: string): string | undefined {
  const alias = workspaceSourceAliases(packages).find(({ find }) => find.test(specifier));
  return alias && specifier.replace(alias.find, alias.replacement);
}

type Resolution = Record<'label' | 'specifier' | 'source', string> & {
  exports: Record<string, string>;
  files: string[];
};

describe('@kit/vite-preset: workspace source aliases', () => {
  it('resolves a package of this workspace to its source', () => {
    expect(resolveSpecifier(REPO_PACKAGES, '@kit/result')?.endsWith('/result/src/index.ts')).toBe(
      true
    );
  });

  it('reads a browser-tier package under packages/platform/<tier>/ too', () => {
    const packages = packagesWith(
      { name: '@acme/fixture', exports: { '.': './dist/index.js' }, files: ['src/index.ts'] },
      'platform/client'
    );

    expect(resolveSpecifier(packages, '@acme/fixture')).toBe(
      join(packages, 'platform/client/fixture/src/index.ts')
    );
  });

  it.each([
    { label: 'an exact export', subpath: './gone', built: './dist/gone.js' },
    { label: 'a wildcard directory', subpath: './tokens/*', built: './dist/tokens/*/index.js' },
  ])(
    'refuses $label whose built file has no source, instead of reading dist',
    ({ subpath, built }) => {
      expect(() => workspaceSourceAliases(fixture({ [subpath]: built }))).toThrow(
        `@acme/fixture exports ${subpath} from ${built}, which has no source at`
      );
    }
  );

  it('skips a package whose sources another app pruned away, its manifest left', () => {
    expect(
      workspaceSourceAliases(
        packagesWith({
          name: '@acme/pruned',
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
      specifier: '@acme/fixture/tokens/color',
      source: 'src/tokens/color/index.ts',
    },
    {
      label: 'a wildcard export with a file capture',
      exports: { './themes/*': './dist/themes/*.js' },
      files: ['src/themes/sand.ts'],
      specifier: '@acme/fixture/themes/sand',
      source: 'src/themes/sand.ts',
    },
    {
      label: 'a wildcard export whose capture spans a slash',
      exports: { './themes/*': './dist/themes/*.js' },
      files: ['src/themes/dark/sand.ts'],
      specifier: '@acme/fixture/themes/dark/sand',
      source: 'src/themes/dark/sand.ts',
    },
    {
      label: 'a wildcard export whose target has no star: every match is that file',
      exports: { './assets/*': './dist/all.js' },
      files: ['src/all.ts'],
      specifier: '@acme/fixture/assets/logo',
      source: 'src/all.ts',
    },
    {
      label: 'a wildcard export whose target has two stars: both take the capture',
      exports: { './themes/*': './dist/*/themes/*.js' },
      files: ['src/sand/themes/sand.ts'],
      specifier: '@acme/fixture/themes/sand',
      source: 'src/sand/themes/sand.ts',
    },
    {
      label: 'an exact export declared after a wildcard that also matches it',
      exports: { './tokens/*': './dist/tokens/*.js', './tokens/color': './dist/color.js' },
      files: ['src/tokens/size.ts', 'src/color.ts'],
      specifier: '@acme/fixture/tokens/color',
      source: 'src/color.ts',
    },
    {
      label: 'the wildcard with the longer prefix, declared after a shorter one',
      exports: { './tokens/*': './dist/tokens/*.js', './tokens/color/*': './dist/color/*.js' },
      files: ['src/tokens/size.ts', 'src/color/dark.ts'],
      specifier: '@acme/fixture/tokens/color/dark',
      source: 'src/color/dark.ts',
    },
  ])('resolves $label', ({ exports, files, specifier, source }) => {
    const packages = fixture(exports, files);

    expect(resolveSpecifier(packages, specifier)).toBe(join(packages, 'universal/fixture', source));
  });

  it.each([
    { label: 'a bare specifier', specifier: '@acme/fixture' },
    { label: 'an empty capture', specifier: '@acme/fixture/tokens/' },
    { label: 'another subpath', specifier: '@acme/fixture/other/color' },
    {
      label: 'a package without a src directory',
      specifier: '@kit/tsconfig/client.json',
      inRepo: true,
    },
    { label: 'a server package', specifier: '@kit/logger', inRepo: true },
  ])('leaves $label to the package exports', ({ specifier, inRepo }) => {
    const packages = inRepo
      ? REPO_PACKAGES
      : fixture({ './tokens/*': './dist/tokens/*/index.js' }, ['src/tokens/color/index.ts']);

    expect(resolveSpecifier(packages, specifier)).toBeUndefined();
  });
});
