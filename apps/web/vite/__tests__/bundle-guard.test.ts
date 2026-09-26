import { type BundledChunk, bundleViolations } from '../bundle-guard';

const ROUTES = '/repo/apps/web/src/routes';

function chunk(fileName: string, moduleIds: string[], isEntry = false, code = ''): BundledChunk {
  return { fileName, isEntry, moduleIds, code };
}

const entry = chunk('assets/main.js', ['/repo/apps/web/src/router.tsx'], true);
const watch = chunk('assets/watch.js', [`${ROUTES}/watch.$videoId.tsx?tsr-split=component`]);
const trending = chunk('assets/trending.js', [`${ROUTES}/trending.tsx?tsr-split=component`]);

describe('apps/web: bundle guard', () => {
  it('passes a bundle with every route in its own chunk and no devtools', () => {
    expect(bundleViolations([entry, watch, trending])).toEqual([]);
  });

  it.each([
    '@tanstack/react-router-devtools',
    '@tanstack/react-query-devtools',
    '@tanstack/router-devtools-core',
    '@tanstack/query-devtools',
  ])('refuses %s in a production chunk', (devtools) => {
    const leaked = chunk('assets/devtools.js', [
      `/repo/node_modules/.pnpm/x/node_modules/${devtools}/dist/esm/index.js`,
    ]);

    expect(bundleViolations([entry, watch, leaked])).toEqual([
      `assets/devtools.js carries ${devtools}, which only the dev server may load`,
    ]);
  });

  it('refuses a route split into the entry chunk', () => {
    const merged = chunk('assets/main.js', [...entry.moduleIds, ...trending.moduleIds], true);

    expect(bundleViolations([merged, watch])).toEqual([
      'assets/main.js is an entry chunk but carries the route src/routes/trending.tsx',
    ]);
  });

  it('refuses two routes sharing one chunk', () => {
    const shared = chunk('assets/shared.js', [...watch.moduleIds, ...trending.moduleIds]);

    expect(bundleViolations([entry, shared])).toEqual([
      'assets/shared.js carries two routes: src/routes/trending.tsx, src/routes/watch.$videoId.tsx',
    ]);
  });

  it('refuses a client chunk that reads the server environment', () => {
    const leaked = chunk(watch.fileName, [...watch.moduleIds], false, 'const u = process.env.X;');

    expect(bundleViolations([entry, leaked])).toEqual([
      'assets/watch.js reads the server environment, which only the SSR server has',
    ]);
  });

  it('refuses a bundle in which no route was split out at all', () => {
    expect(bundleViolations([entry])).toEqual(['no route was split into a chunk of its own']);
  });
});
