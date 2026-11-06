import { reactPlugins } from '@vp/vite-preset/react-plugins';
import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig, mergeConfig, type ViteUserConfig } from 'vitest/config';

// Vitest loads an app's config with this package external, and Node cannot resolve an extensionless
// relative import between two of its source files: the React plugins are reached by their package subpath.

const ALL_SPECS = 'src/**/__tests__/**/*.test.{ts,tsx}';
const DOM_SPECS = 'src/**/__tests__/**/*.dom.test.{ts,tsx}';
const API_SERVER_SETUP = '@vp/web-testing/api-server.setup';
const SERVER_FUNCTIONS_SETUP = '@vp/web-testing/server-functions.setup';
const JSDOM_SETUP = ['@testing-library/jest-dom/vitest', '@vp/web-testing/jsdom.setup'];

export type ClientAppTestOptions = {
  /** The app's name, which names the project: `web`, `web (jsdom)`. */
  app: string;
  /** `node` runs every spec but the `*.dom.test.*` ones in a shared worker; `jsdom` runs those, isolated. */
  environment: 'node' | 'jsdom';
  /** The app's own setup files, run before the shared ones. */
  setupFiles?: readonly string[];
  /** `false` builds the project without the React Compiler: the uncompiled half of a differential spec. */
  compiler?: false;
  /** The `jsdom` specs this project runs instead of every `*.dom.test.*` one. */
  include?: readonly string[];
};

type AppViteConfig = (env: ConfigEnv) => Promise<UserConfig> | UserConfig;

function project({ app, environment, setupFiles = [], compiler, include }: ClientAppTestOptions) {
  if (environment === 'jsdom') {
    return {
      name: compiler === false ? `${app} (jsdom, uncompiled)` : `${app} (jsdom)`,
      environment,
      isolate: true,
      include: [...(include ?? [DOM_SPECS])],
      setupFiles: [...setupFiles, ...JSDOM_SETUP, API_SERVER_SETUP],
    };
  }
  return {
    name: app,
    environment,
    isolate: false,
    include: [ALL_SPECS],
    exclude: ['**/node_modules/**', DOM_SPECS],
    setupFiles: [...setupFiles, SERVER_FUNCTIONS_SETUP, API_SERVER_SETUP],
  };
}

/**
 * One of a client app's two Vitest projects, over the app's own Vite config: the MSW server answers
 * the API in both, server functions run without the Start compiler (inside the rendered request in
 * `node`, over the cookie jar in `jsdom`), the `?url` stylesheet imports resolve, and stubbed globals
 * and environment are restored after every test.
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
