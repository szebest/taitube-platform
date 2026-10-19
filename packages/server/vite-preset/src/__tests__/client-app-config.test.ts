import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type BundledChunk,
  bundleViolations,
  clientAppConfig,
  serverBundleViolations,
  workspaceSourceAliases,
} from '../client-app-config';

const PACKAGES = fileURLToPath(new URL('../../../..', import.meta.url));

type Fixture = {
  name: string;
  src?: boolean;
  exports: Record<string, { import: string }>;
  files?: string[];
};

function packagesWith({ name, src = true, exports, files = [] }: Fixture): string {
  const packages = mkdtempSync(join(tmpdir(), 'vite-preset-'));
  const packageDir = join(packages, 'universal', name.replace('@vp/', ''));
  mkdirSync(join(packages, 'client'));
  mkdirSync(src ? join(packageDir, 'src') : packageDir, { recursive: true });
  writeFileSync(join(packageDir, 'package.json'), JSON.stringify({ name, exports }));
  for (const file of files) {
    mkdirSync(dirname(join(packageDir, file)), { recursive: true });
    writeFileSync(join(packageDir, file), '');
  }
  return packages;
}

const goneExport = { './gone': { import: './dist/gone.js' } };

function aliasFor(packages: string, specifier: string): string | undefined {
  const alias = workspaceSourceAliases(packages).find(({ find }) =>
    (find as RegExp).test(specifier)
  );
  return alias && specifier.replace(alias.find, alias.replacement);
}

function replacementFor(name: string): string | undefined {
  const alias = workspaceSourceAliases(PACKAGES).find(({ find }) =>
    find instanceof RegExp ? find.test(name) : find === name
  );
  return alias?.replacement;
}

describe('@vp/vite-preset: workspace source aliases', () => {
  it.each([
    { name: '@vp/intl-react', source: 'packages/client/intl-react/src/index.ts' },
    { name: '@vp/api-client', source: 'packages/client/api-client/src/index.ts' },
    { name: '@vp/result', source: 'packages/universal/result/src/index.ts' },
    { name: '@vp/domain/time', source: 'packages/universal/domain/src/time.ts' },
    { name: '@vp/web-testing/server', source: 'packages/client/web-testing/src/server/index.ts' },
  ])('resolves $name to its source', ({ name, source }) => {
    expect(replacementFor(name)?.endsWith(source)).toBe(true);
  });

  it('refuses an export whose built file has no source, instead of reading dist', () => {
    const packages = packagesWith({ name: '@vp/stale', exports: goneExport });

    expect(() => workspaceSourceAliases(packages)).toThrow(
      '@vp/stale exports ./gone from ./dist/gone.js, which has no source at'
    );
  });

  it('skips a package whose sources another app pruned away, its manifest left', () => {
    expect(
      workspaceSourceAliases(packagesWith({ name: '@vp/pruned', src: false, exports: goneExport }))
    ).toEqual([]);
  });

  it.each([
    {
      label: 'an exact export',
      subpath: './time',
      built: './dist/time.js',
      files: ['src/time.ts'],
      specifier: '@vp/fixture/time',
      source: 'src/time.ts',
    },
    {
      label: 'a wildcard export with a directory capture',
      subpath: './tokens/*',
      built: './dist/tokens/*/index.js',
      files: ['src/tokens/color/index.ts'],
      specifier: '@vp/fixture/tokens/color',
      source: 'src/tokens/color/index.ts',
    },
    {
      label: 'a wildcard export with a file capture',
      subpath: './themes/*',
      built: './dist/themes/*.js',
      files: ['src/themes/sand.ts'],
      specifier: '@vp/fixture/themes/sand',
      source: 'src/themes/sand.ts',
    },
    {
      label: 'a wildcard export whose capture spans a slash',
      subpath: './themes/*',
      built: './dist/themes/*.js',
      files: ['src/themes/dark/sand.ts'],
      specifier: '@vp/fixture/themes/dark/sand',
      source: 'src/themes/dark/sand.ts',
    },
  ])('resolves $label', ({ subpath, built, files, specifier, source }) => {
    const packages = packagesWith({
      name: '@vp/fixture',
      exports: { [subpath]: { import: built } },
      files,
    });

    expect(aliasFor(packages, specifier)).toBe(join(packages, 'universal/fixture', source));
  });

  it.each([
    { label: 'a bare specifier', specifier: '@vp/fixture' },
    { label: 'an empty capture', specifier: '@vp/fixture/tokens/' },
    { label: 'another subpath', specifier: '@vp/fixture/other/color' },
  ])('leaves $label to the package exports', ({ specifier }) => {
    const packages = packagesWith({
      name: '@vp/fixture',
      exports: { './tokens/*': { import: './dist/tokens/*/index.js' } },
      files: ['src/tokens/color/index.ts'],
    });

    expect(aliasFor(packages, specifier)).toBeUndefined();
  });

  it('refuses a wildcard export whose source directory is missing', () => {
    const packages = packagesWith({
      name: '@vp/fixture',
      exports: { './tokens/*': { import: './dist/tokens/*/index.js' } },
    });

    expect(() => workspaceSourceAliases(packages)).toThrow(
      '@vp/fixture exports ./tokens/* from ./dist/tokens/*/index.js, which has no source at'
    );
  });

  it.each(['@vp/api-contracts/openapi', '@vp/adapters', '@vp/core'])(
    'leaves %s to the package exports',
    (name) => {
      expect(replacementFor(name)).toBeUndefined();
    }
  );
});

const ROUTES = '/repo/apps/client/web/src/routes';
const RULES = {
  devOnlyDirs: ['src/features/design-system'],
  forbiddenDirs: ['src/modules/Upload'],
};

function chunk(fileName: string, moduleIds: string[], isEntry = false, code = ''): BundledChunk {
  return { fileName, isEntry, moduleIds, code };
}

const entry = chunk('assets/main.js', ['/repo/apps/client/web/src/router.tsx'], true);
const watch = chunk('assets/watch.js', [`${ROUTES}/watch.$videoId.tsx?tsr-split=component`]);
const trending = chunk('assets/trending.js', [`${ROUTES}/trending.tsx?tsr-split=component`]);

describe('@vp/vite-preset: bundle guard', () => {
  it('passes a bundle with every route in its own chunk and no devtools', () => {
    expect(bundleViolations([entry, watch, trending], RULES)).toEqual([]);
  });

  it.each([
    ...[
      '@tanstack/react-router-devtools',
      '@tanstack/react-query-devtools',
      '@tanstack/router-devtools-core',
      '@tanstack/query-devtools',
    ].map((name) => [name, `/repo/node_modules/.pnpm/x/node_modules/${name}/dist/esm/index.js`]),
    ['src/features/design-system', '/repo/apps/client/web/src/features/design-system/showcase.tsx'],
    ['dev-only/', '/repo/packages/client/queries/src/dev-only/persona-switcher.tsx'],
  ])('refuses %s in a production chunk', (name, moduleId) => {
    const leaked = chunk('assets/leaked.js', [moduleId]);

    expect(bundleViolations([entry, watch, leaked], RULES)).toEqual([
      `assets/leaked.js carries ${name}, which only the dev server may load`,
    ]);
  });

  it('refuses a dev-only module in the server bundle, which may read its environment and keep its routes', () => {
    const server = chunk('server.js', [`${ROUTES}/watch.$videoId.tsx`], true, 'process.env.PORT');
    const leaked = chunk('assets/persona-sign-in.js', [
      '/repo/packages/client/queries/src/dev-only/persona-sign-in.ts',
    ]);

    expect(serverBundleViolations([server, leaked], RULES)).toEqual([
      'assets/persona-sign-in.js carries dev-only/, which only the dev server may load',
    ]);
  });

  it('refuses a directory whose code moved to another app, in any chunk', () => {
    const leaked = chunk('assets/upload.js', ['/repo/apps/client/web/src/modules/Upload/index.ts']);

    expect(bundleViolations([entry, watch, leaked], RULES)).toEqual([
      'assets/upload.js carries src/modules/Upload, which this app no longer ships',
    ]);
  });

  it('refuses a route split into the entry chunk', () => {
    const merged = chunk('assets/main.js', [...entry.moduleIds, ...trending.moduleIds], true);

    expect(bundleViolations([merged, watch], RULES)).toEqual([
      'assets/main.js is an entry chunk but carries the route src/routes/trending.tsx',
    ]);
  });

  it('refuses two routes sharing one chunk', () => {
    const shared = chunk('assets/shared.js', [...watch.moduleIds, ...trending.moduleIds]);

    expect(bundleViolations([entry, shared], RULES)).toEqual([
      'assets/shared.js carries two routes: src/routes/trending.tsx, src/routes/watch.$videoId.tsx',
    ]);
  });

  it('refuses a client chunk that reads the server environment', () => {
    const leaked = chunk(watch.fileName, [...watch.moduleIds], false, 'const u = process.env.X;');

    expect(bundleViolations([entry, leaked], RULES)).toEqual([
      'assets/watch.js reads the server environment, which only the SSR server has',
    ]);
  });

  it('refuses a bundle in which no route was split out at all', () => {
    expect(bundleViolations([entry], RULES)).toEqual([
      'no route was split into a chunk of its own',
    ]);
  });
});

const APP = new URL('../../../../../apps/client/web/', import.meta.url);

function resolveConfig(port: number, command: 'serve' | 'build' = 'serve') {
  const config = clientAppConfig({ configUrl: new URL('vite.config.ts', APP).href, port });
  return config({ command, mode: 'test' });
}

describe('@vp/vite-preset: client app config', () => {
  it("serves dev and preview on the app's port only, with Sass reading the app's src", async () => {
    const config = await resolveConfig(5174);

    expect(config.server).toEqual({ port: 5174, strictPort: true });
    expect(config.preview).toEqual({ port: 5174, strictPort: true });
    expect(config.css?.preprocessorOptions?.scss).toEqual({
      loadPaths: [fileURLToPath(new URL('src', APP))],
    });
  });

  it.each([
    { command: 'build' as const, ssr: { noExternal: true } },
    { command: 'serve' as const, ssr: {} },
  ])(
    'bundles every npm module into the server output on $command only',
    async ({ command, ssr }) => {
      expect((await resolveConfig(5174, command)).ssr).toEqual(ssr);
    }
  );
});
