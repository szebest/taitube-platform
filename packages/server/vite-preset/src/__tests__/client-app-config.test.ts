import { fileURLToPath } from 'node:url';
import {
  type BundledChunk,
  bundleViolations,
  clientAppConfig,
  workspaceSourceAliases,
} from '../client-app-config';

const PACKAGES = fileURLToPath(new URL('../../../..', import.meta.url));

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
  ])('resolves $name to its source', ({ name, source }) => {
    expect(replacementFor(name)?.endsWith(source)).toBe(true);
  });

  it.each(['@vp/api-contracts/openapi', '@vp/adapters', '@vp/core'])(
    'leaves %s to the package exports',
    (name) => {
      expect(replacementFor(name)).toBeUndefined();
    }
  );
});

const ROUTES = '/repo/apps/client/web/src/routes';
const DEV_ONLY_DIRS = ['src/features/design-system'];

function chunk(fileName: string, moduleIds: string[], isEntry = false, code = ''): BundledChunk {
  return { fileName, isEntry, moduleIds, code };
}

const entry = chunk('assets/main.js', ['/repo/apps/client/web/src/router.tsx'], true);
const watch = chunk('assets/watch.js', [`${ROUTES}/watch.$videoId.tsx?tsr-split=component`]);
const trending = chunk('assets/trending.js', [`${ROUTES}/trending.tsx?tsr-split=component`]);

describe('@vp/vite-preset: bundle guard', () => {
  it('passes a bundle with every route in its own chunk and no devtools', () => {
    expect(bundleViolations([entry, watch, trending], DEV_ONLY_DIRS)).toEqual([]);
  });

  it.each([
    ...[
      '@tanstack/react-router-devtools',
      '@tanstack/react-query-devtools',
      '@tanstack/router-devtools-core',
      '@tanstack/query-devtools',
    ].map((name) => [name, `/repo/node_modules/.pnpm/x/node_modules/${name}/dist/esm/index.js`]),
    ['src/features/design-system', '/repo/apps/client/web/src/features/design-system/showcase.tsx'],
  ])('refuses %s in a production chunk', (name, moduleId) => {
    const leaked = chunk('assets/leaked.js', [moduleId]);

    expect(bundleViolations([entry, watch, leaked], DEV_ONLY_DIRS)).toEqual([
      `assets/leaked.js carries ${name}, which only the dev server may load`,
    ]);
  });

  it('refuses a route split into the entry chunk', () => {
    const merged = chunk('assets/main.js', [...entry.moduleIds, ...trending.moduleIds], true);

    expect(bundleViolations([merged, watch], DEV_ONLY_DIRS)).toEqual([
      'assets/main.js is an entry chunk but carries the route src/routes/trending.tsx',
    ]);
  });

  it('refuses two routes sharing one chunk', () => {
    const shared = chunk('assets/shared.js', [...watch.moduleIds, ...trending.moduleIds]);

    expect(bundleViolations([entry, shared], DEV_ONLY_DIRS)).toEqual([
      'assets/shared.js carries two routes: src/routes/trending.tsx, src/routes/watch.$videoId.tsx',
    ]);
  });

  it('refuses a client chunk that reads the server environment', () => {
    const leaked = chunk(watch.fileName, [...watch.moduleIds], false, 'const u = process.env.X;');

    expect(bundleViolations([entry, leaked], DEV_ONLY_DIRS)).toEqual([
      'assets/watch.js reads the server environment, which only the SSR server has',
    ]);
  });

  it('refuses a bundle in which no route was split out at all', () => {
    expect(bundleViolations([entry], DEV_ONLY_DIRS)).toEqual([
      'no route was split into a chunk of its own',
    ]);
  });
});

const APP = new URL('../../../../../apps/client/web/', import.meta.url);

function resolveConfig(port: number) {
  const config = clientAppConfig({ configUrl: new URL('vite.config.ts', APP).href, port });
  return config({ command: 'serve', mode: 'test' });
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
});
