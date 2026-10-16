import { clientAppTestConfig } from '@vp/vite-preset/vitest';
import viteConfig from './vite.config';

export default await clientAppTestConfig(viteConfig, {
  app: 'web',
  environment: 'node',
  setupFiles: ['src/__tests__/live-page.setup.ts'],
});
