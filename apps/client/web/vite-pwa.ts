import { fileURLToPath } from 'node:url';
import { workspaceSourceAliases } from '@vp/vite-preset';
import { type Plugin, type PluginOption, runnerImport } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { WebManifest } from './src/features/pwa/manifest';

const PACKAGES_DIR = fileURLToPath(new URL('../../../packages', import.meta.url));
const MANIFEST_MODULE = fileURLToPath(new URL('./src/features/pwa/manifest.ts', import.meta.url));

/** Loads the manifest module through Vite, so `@vp/ui` and `@vp/design-tokens` resolve from source. */
async function loadManifest(): Promise<WebManifest> {
  const { module } = await runnerImport<{ webManifest: () => WebManifest }>(MANIFEST_MODULE, {
    configFile: false,
    resolve: { alias: workspaceSourceAliases(PACKAGES_DIR) },
  });
  return module.webManifest();
}

/**
 * TanStack Start builds a client and an SSR environment, each resolving its own config, and the
 * PWA plugin keeps only the last one it saw: the SSR one, which switches its service worker build
 * off. It sees the client's config and bundle only.
 */
function clientEnvironmentOnly(plugin: Plugin): Plugin {
  const { configResolved } = plugin;
  return {
    ...plugin,
    applyToEnvironment: (environment) => environment.name === 'client',
    configResolved:
      typeof configResolved === 'function'
        ? function (config) {
            if (!config.build.ssr) {
              return configResolved.call(this, config);
            }
          }
        : configResolved,
  };
}

/** The service worker (`src/sw.ts`, injected with the build's asset manifest) and the web manifest. */
export async function pwaPlugins(): Promise<PluginOption[]> {
  return VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    registerType: 'prompt',
    injectRegister: false,
    manifest: await loadManifest(),
    manifestFilename: 'manifest.webmanifest',
    injectManifest: { globPatterns: ['**/*.{js,css,woff2}'] },
    devOptions: { enabled: false },
  }).map(clientEnvironmentOnly);
}
