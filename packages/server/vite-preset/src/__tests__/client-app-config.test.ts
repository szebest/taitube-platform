import { fileURLToPath } from 'node:url';
import type { PluginOption } from 'vite';
import {
  type BundledChunk,
  bundleViolations,
  clientAppConfig,
  serverBundleViolations,
} from '../client-app-config';

const ROUTES = '/repo/apps/client/web/src/routes';
const RULES = { forbiddenDirs: ['src/modules/Upload'] };

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

const APP = new URL('../../../../../apps/client/web/', import.meta.url);

function resolveConfig(
  port: number,
  command: 'serve' | 'build' = 'serve',
  { mode = 'test', plugins }: { mode?: string; plugins?: () => PluginOption[] } = {}
) {
  const config = clientAppConfig({ configUrl: new URL('vite.config.ts', APP).href, port, plugins });
  return config({ command, mode });
}

describe('@vp/vite-preset: client app config', () => {
  it("serves dev and preview on the app's port only, with Sass reading the app's src", async () => {
    const config = await resolveConfig(5174);

    expect(config.server).toEqual({ port: 5174, strictPort: true });
    expect(config.preview).toEqual({ host: '127.0.0.1', port: 5174, strictPort: true });
    expect(config.css?.preprocessorOptions?.scss).toEqual({
      loadPaths: [fileURLToPath(new URL('src', APP))],
    });
  });

  it("adds the app's plugins after its own, except under test", async () => {
    const extra = { name: 'app:extra' };
    const names = async (mode: string) =>
      ((await resolveConfig(5173, 'build', { mode, plugins: () => [extra] })).plugins ?? []).flat();

    expect(await names('test')).not.toContain(extra);
    expect((await names('production')).at(-1)).toBe(extra);
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
