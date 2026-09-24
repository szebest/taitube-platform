import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { src: resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'node',
    globals: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: [
            'react',
            'react-dom',
            'react-dom/server',
            'react-router-dom',
            'react-router',
            '@reduxjs/toolkit',
            '@reduxjs/toolkit/query/react',
            'react-redux',
            'react-bootstrap',
            'react-toastify',
            'framer-motion',
            'react-pro-sidebar',
            'react-player',
          ],
        },
      },
    },
  },
});
