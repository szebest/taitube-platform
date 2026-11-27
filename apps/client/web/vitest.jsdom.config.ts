import { clientAppTestConfig } from '@kit/vite-preset/vitest';
import { JSDOM_SETUP_FILES, SPEC_ENV } from '@vp/web-testing/setup-files';
import { mergeConfig } from 'vite-plus';
import viteConfig from './vite.config';

export default mergeConfig(
  await clientAppTestConfig(viteConfig, {
    app: 'web',
    environment: 'jsdom',
    setupFiles: ['@kit/web-telemetry/off.setup', ...JSDOM_SETUP_FILES],
    env: SPEC_ENV,
  }),
  // Inlined, so the engine spec's vi.mock('hls.js') reaches the copy @videojs/hlsjs-video imports.
  { test: { server: { deps: { inline: [/@videojs\//] } } } }
);
