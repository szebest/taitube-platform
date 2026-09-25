import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      css: { include: [/\.css\?url/, /\/src\/index\.scss\?url/] },
      globals: true,
      restoreMocks: true,
      unstubEnvs: true,
      unstubGlobals: true,
      testTimeout: 30_000,
      hookTimeout: 30_000,
      include: ['src/**/__tests__/**/*.test.{ts,tsx}', 'vite/**/__tests__/**/*.test.ts'],
      setupFiles: ['src/__tests__/local-storage.setup.ts'],
    },
  })
);
