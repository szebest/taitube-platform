import { clientAppTestConfig } from '@vp/vite-preset/vitest';
import { mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  await clientAppTestConfig(viteConfig, { app: 'web', environment: 'jsdom' }),
  // Inlined, so the engine spec's vi.mock('hls.js') reaches the copy @videojs/hlsjs-video imports.
  { test: { server: { deps: { inline: [/@videojs\//] } } } }
);
