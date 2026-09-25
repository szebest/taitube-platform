import { fileURLToPath } from 'node:url';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { bundleGuard } from './vite/bundle-guard';
import { workspaceSourceAliases } from './vite/workspace-sources';

const DEV_PORT = 5173;

export default defineConfig({
  resolve: {
    alias: [
      { find: 'src', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      ...workspaceSourceAliases(fileURLToPath(new URL('../../packages', import.meta.url))),
    ],
  },
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: DEV_PORT, strictPort: true },
  plugins: [
    tanstackStart({
      router: {
        routeFileIgnorePattern: '__tests__',
        quoteStyle: 'single',
        semicolons: true,
      },
    }),
    viteReact(),
    bundleGuard(),
  ],
});
