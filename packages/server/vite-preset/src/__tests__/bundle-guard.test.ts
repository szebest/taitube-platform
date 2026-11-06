import { type BundledChunk, bundleViolations, serverBundleViolations } from '../bundle-guard';

const ROUTES = '/repo/apps/client/web/src/routes';
const RULES = { forbiddenDirs: ['src/modules/Upload'] };

function chunk(
  fileName: string,
  moduleIds: readonly string[],
  isEntry = false,
  code = '',
  imports: readonly string[] = []
): BundledChunk {
  return { fileName, isEntry, moduleIds, imports, code };
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

    expect(serverBundleViolations([server, leaked])).toEqual([
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

describe('@vp/vite-preset: bundle budget and vendor chunks', () => {
  const NOISE = Array.from({ length: 4000 }, (_, i) => `v${i}=${(i * 2654435761) % 1000003}`).join(
    ';'
  );
  const withCode = (fileName: string, code: string, isEntry: boolean) =>
    chunk(fileName, entry.moduleIds, isEntry, code);

  it('refuses an entry chunk whose gzip size passes the budget, and only the entry', () => {
    const big = withCode('assets/main.js', NOISE, true);
    const lazy = withCode('assets/lazy.js', NOISE, false);

    expect(bundleViolations([big, lazy, watch], { entryBudgetKb: 1 })).toEqual([
      expect.stringMatching(/^assets\/main\.js is \d+(\.\d)? KB gzip, over the 1 KB entry budget$/),
    ]);
  });

  it('passes an entry chunk inside the budget, and any size without a budget', () => {
    const big = withCode('assets/main.js', NOISE, true);

    expect(bundleViolations([big, watch], { entryBudgetKb: 120 })).toEqual([]);
    expect(bundleViolations([big, watch], {})).toEqual([]);
  });

  it('refuses an initial load over its budget, counting every chunk the entry imports and no other', () => {
    const shared = withCode('assets/shared-1a.js', NOISE, false);
    const nested = withCode('assets/nested.js', NOISE, false);
    const lazy = withCode('assets/lazy.js', NOISE, false);
    const loading = chunk('assets/main.js', entry.moduleIds, true, 'a', [shared.fileName]);
    const sharedLoadingNested = { ...shared, imports: [nested.fileName] };

    expect(
      bundleViolations([loading, sharedLoadingNested, nested, lazy, watch], { initialBudgetKb: 1 })
    ).toEqual([
      expect.stringMatching(/^the initial load is \d+(\.\d)? KB gzip, over the 1 KB budget$/),
    ]);
    expect(
      bundleViolations([loading, sharedLoadingNested, nested, lazy, watch], {
        initialBudgetKb: 120,
      })
    ).toEqual([]);
  });

  it('refuses a vendor chunk that imports app code, which would make it and the entry a cycle', () => {
    const vendor = chunk('assets/vendor-tanstack-1a.js', ['/r/vendor.js'], false, '', [
      'assets/rolldown-runtime-1a.js',
      'assets/vendor-react-1a.js',
      'assets/session-provider-1a.js',
    ]);

    expect(bundleViolations([entry, watch, vendor], {})).toEqual([
      'assets/vendor-tanstack-1a.js imports assets/session-provider-1a.js, an app chunk',
    ]);
  });

  it('refuses a vendor module bundled into two chunks', () => {
    const react = '/repo/node_modules/.pnpm/react@19/node_modules/react/index.js';
    const a = chunk('assets/a.js', [react]);
    const b = chunk('assets/b.js', [react, '/repo/packages/client/ui/src/button.tsx']);

    expect(bundleViolations([entry, watch, a, b], {})).toEqual([
      `${react} is bundled into assets/a.js and assets/b.js`,
    ]);
  });

  it.each(['vendor-player', 'vendor-charts'])(
    'refuses the %s chunk anywhere in the entry static imports',
    (vendor) => {
      const lazy = chunk(`assets/${vendor}-1a2b.js`, ['/r/vendor.js']);
      const shared = chunk('assets/shared.js', ['/r/shared.js'], false, '', [lazy.fileName]);
      const loading = chunk('assets/main.js', entry.moduleIds, true, '', [shared.fileName]);

      expect(bundleViolations([loading, shared, lazy, watch], {})).toEqual([
        `${lazy.fileName} loads with the entry, though only the route that needs it may load it`,
      ]);
      expect(bundleViolations([entry, shared, lazy, watch], {})).toEqual([]);
    }
  );
});
