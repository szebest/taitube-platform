import { reactPlugins } from '@kit/vite-preset/react-plugins';
import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig, mergeConfig, type ViteUserConfig } from 'vitest/config';

// Vitest loads an app's config with this package external, and Node cannot resolve an extensionless
// relative import between two of its source files: the React plugins are reached by their package subpath.

const ALL_SPECS = 'src/**/__tests__/**/*.test.{ts,tsx}';
const DOM_SPECS = 'src/**/__tests__/**/*.dom.test.{ts,tsx}';

export type ClientAppTestOptions = {
  /** The app's name, which names the project: `web`, `web (jsdom)`. */
  app: string;
  /** `node` runs every spec but the `*.dom.test.*` ones in a shared worker; `jsdom` runs those, isolated. */
  environment: 'node' | 'jsdom';
  /** Every setup file of the project, in the order they run. */
  setupFiles: readonly string[];
  /** Environment variables every spec of the project runs with. */
  env?: Readonly<Record<string, string>>;
  /** `false` builds the project without the React Compiler: the uncompiled half of a differential spec. */
  compiler?: false;
  /** The `jsdom` specs this project runs instead of every `*.dom.test.*` one. */
  include?: readonly string[];
};

type AppViteConfig = (env: ConfigEnv) => Promise<UserConfig> | UserConfig;

function project({
  app,
  environment,
  setupFiles,
  env = {},
  compiler,
  include,
}: ClientAppTestOptions) {
  if (environment === 'jsdom') {
    return {
      name: compiler === false ? `${app} (jsdom, uncompiled)` : `${app} (jsdom)`,
      environment,
      isolate: true,
      include: [...(include ?? [DOM_SPECS])],
      setupFiles: [...setupFiles],
      env: { ...env, RTL_SKIP_AUTO_CLEANUP: 'true' },
    };
  }
  return {
    name: app,
    environment,
    isolate: false,
    include: [ALL_SPECS],
    exclude: ['**/node_modules/**', DOM_SPECS],
    setupFiles: [...setupFiles],
    env: { ...env },
  };
}

/**
 * One of a client app's two Vitest projects, over the app's own Vite config and the setup files the
 * app names, the `?url` stylesheet imports resolve, and stubbed globals and environment are restored
 * after every test.
 */
export async function clientAppTestConfig(
  viteConfig: AppViteConfig,
  options: ClientAppTestOptions
): Promise<ViteUserConfig> {
  const app = await viteConfig({ command: 'serve', mode: 'test' });
  return mergeConfig(
    options.compiler === false ? { ...app, plugins: reactPlugins(false) } : app,
    defineConfig({
      test: {
        ...project(options),
        pool: 'threads',
        css: { include: [/\.s?css\?url/] },
        globals: true,
        restoreMocks: true,
        unstubEnvs: true,
        unstubGlobals: true,
        testTimeout: 30_000,
        hookTimeout: 30_000,
      },
    })
  );
}
