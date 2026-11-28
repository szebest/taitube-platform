import { fileURLToPath } from 'node:url';
import { clientAppConfig } from '@kit/vite-preset';
import { defineConfig, mergeConfig } from 'vitest/config';

const shop = clientAppConfig({
  configUrl: import.meta.url,
  port: 5190,
  packagesDir: fileURLToPath(new URL('packages', import.meta.url)),
});

export default defineConfig(async (env) =>
  mergeConfig(await shop(env), {
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/__tests__/*.test.{ts,tsx}'],
      server: { deps: { inline: [/\/@kit\//] } },
    },
  })
);
