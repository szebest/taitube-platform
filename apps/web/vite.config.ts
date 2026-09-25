import { fileURLToPath } from 'node:url';
import viteReact from '@vitejs/plugin-react';
import { type PluginOption, defineConfig } from 'vite';
import { workspaceSourceAliases } from './vite/workspace-sources';

const DEV_PORT = 5173;

// Vitest loads every project's config even when it runs another project; the Start plugin's
// config hook then crawls routes in the background of that run. Specs use the committed tree.
async function appPlugins(mode: string): Promise<PluginOption[]> {
  if (mode === 'test') return [viteReact()];
  const [{ tanstackStart }, { bundleGuard }] = await Promise.all([
    import('@tanstack/react-start/plugin/vite'),
    import('./vite/bundle-guard'),
  ]);
  return [
    tanstackStart({
      router: { routeFileIgnorePattern: '__tests__', quoteStyle: 'single', semicolons: true },
    }),
    viteReact(),
    bundleGuard(),
  ];
}

export default defineConfig(async ({ mode }) => ({
  resolve: {
    alias: workspaceSourceAliases(fileURLToPath(new URL('../../packages', import.meta.url))),
  },
  css: {
    preprocessorOptions: {
      scss: { loadPaths: [fileURLToPath(new URL('./src', import.meta.url))] },
    },
  },
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: DEV_PORT, strictPort: true },
  plugins: await appPlugins(mode),
}));
