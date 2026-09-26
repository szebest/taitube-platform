import { type ViteUserConfig, defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export const DOM_SPECS = 'src/**/__tests__/**/*.dom.test.tsx';

export const MSW_SETUP = 'src/__tests__/msw/api-server.setup.ts';

export async function webTestConfig(test: NonNullable<ViteUserConfig['test']>) {
  return mergeConfig(
    await viteConfig({ command: 'serve', mode: 'test' }),
    defineConfig({
      test: {
        css: { include: [/\.css\?url/, /\/src\/index\.scss\?url/] },
        globals: true,
        restoreMocks: true,
        unstubEnvs: true,
        unstubGlobals: true,
        testTimeout: 30_000,
        hookTimeout: 30_000,
        ...test,
      },
    })
  );
}

export default webTestConfig({
  environment: 'node',
  include: ['src/**/__tests__/**/*.test.{ts,tsx}', 'vite/**/__tests__/**/*.test.ts'],
  exclude: ['**/node_modules/**', DOM_SPECS],
  setupFiles: ['src/__tests__/live-page.setup.ts', MSW_SETUP],
});
