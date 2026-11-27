import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import type { PluginOption } from 'vite';
import { clientAppConfig, vendorChunkOf } from '../client-app-config';

describe('@kit/vite-preset: vendor chunks', () => {
  it.each([
    ['vendor-react', '/r/node_modules/.pnpm/react-dom@19/node_modules/react-dom/client.js'],
    ['vendor-react', '/r/node_modules/.pnpm/scheduler@1/node_modules/scheduler/index.js'],
    ['vendor-tanstack', '/r/node_modules/.pnpm/x/node_modules/@tanstack/router-core/dist/index.js'],
    ['vendor-player', '/r/node_modules/.pnpm/x/node_modules/hls.js/dist/hls.mjs'],
    ['vendor-player', '/r/node_modules/.pnpm/x/node_modules/@videojs/core/dist/index.js'],
    ['vendor-charts', '/r/node_modules/.pnpm/x/node_modules/recharts/es6/index.js'],
    ['vendor-charts', '/r/node_modules/.pnpm/x/node_modules/d3-scale/src/index.js'],
    [null, '/r/node_modules/.pnpm/x/node_modules/@tanstack/react-start-client/dist/index.js'],
    [null, '/r/node_modules/.pnpm/x/node_modules/@tanstack/start-client-core/dist/index.js'],
    [null, '/r/node_modules/.pnpm/x/node_modules/zod/index.js'],
    [null, '/r/apps/client/web/src/router.tsx'],
  ])('puts a vendor module in the %s chunk: %s', (name, id) => {
    expect(vendorChunkOf(id)).toBe(name);
  });
});

const ROOT = new URL('../../../../../../', import.meta.url);
const APP = new URL('apps/client/web/', ROOT);
const PACKAGES_DIR = fileURLToPath(new URL('packages', ROOT));

function resolveConfig(
  port: number,
  command: 'serve' | 'build' = 'serve',
  {
    mode = 'test',
    plugins,
    packagesDir = PACKAGES_DIR,
  }: { mode?: string; plugins?: (target: string[]) => PluginOption[]; packagesDir?: string } = {}
) {
  const config = clientAppConfig({
    configUrl: new URL('vite.config.ts', APP).href,
    port,
    packagesDir,
    plugins,
  });
  return config({ command, mode });
}

describe('@kit/vite-preset: client app config', () => {
  it("serves dev and preview on the app's port only, with Sass reading the app's src", async () => {
    const config = await resolveConfig(5174);

    expect(config.server).toEqual({ port: 5174, strictPort: true });
    expect(config.preview).toEqual({ host: '127.0.0.1', port: 5174, strictPort: true });
    expect(config.css?.preprocessorOptions?.scss).toEqual({
      loadPaths: [fileURLToPath(new URL('src', APP))],
    });
  });

  it('scans every browser-tier package source for dependencies, specs and stories left out', async () => {
    const entries = (await resolveConfig(5174)).environments?.client?.optimizeDeps?.entries;

    expect(entries).toEqual([
      expect.stringMatching(/\/packages\/universal\/\*\/src\/\*\*\/\*\.\{ts,tsx\}$/),
      expect.stringMatching(/\/packages\/platform\/universal\/\*\/src\/\*\*\/\*\.\{ts,tsx\}$/),
      expect.stringMatching(/\/packages\/client\/\*\/src\/\*\*\/\*\.\{ts,tsx\}$/),
      expect.stringMatching(/\/packages\/platform\/client\/\*\/src\/\*\*\/\*\.\{ts,tsx\}$/),
      '!**/__tests__/**',
      '!**/__stories__/**',
    ]);
  });

  it('derives the dependency scan and the aliases from the packages directory the app names', async () => {
    const packagesDir = join(tmpdir(), 'no-such-workspace', 'packages');

    const config = await resolveConfig(5174, 'serve', { packagesDir });

    expect(config.resolve?.alias).toEqual([]);
    expect(config.environments?.client?.optimizeDeps?.entries).toEqual([
      `${packagesDir}/universal/*/src/**/*.{ts,tsx}`,
      `${packagesDir}/platform/universal/*/src/**/*.{ts,tsx}`,
      `${packagesDir}/client/*/src/**/*.{ts,tsx}`,
      `${packagesDir}/platform/client/*/src/**/*.{ts,tsx}`,
      '!**/__tests__/**',
      '!**/__stories__/**',
    ]);
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

  it("compiles the client build to the root's browserslist, and hands that target to the app's plugins", async () => {
    const { browserslist }: { browserslist: string[] } = JSON.parse(
      readFileSync(new URL('package.json', ROOT), 'utf8')
    );
    const target = browserslistToEsbuild(browserslist);
    const received: string[][] = [];

    const config = await resolveConfig(5174, 'build', {
      mode: 'production',
      plugins: (pluginTarget) => {
        received.push(pluginTarget);
        return [];
      },
    });

    expect(config.environments?.client?.build?.target).toEqual(target);
    expect(received).toEqual([target]);
    expect(target).toContain('safari17.4');
  });
});
