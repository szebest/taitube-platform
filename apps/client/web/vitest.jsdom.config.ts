import { clientAppTestConfig } from '@vp/vite-preset/vitest';
import viteConfig from './vite.config';

export default await clientAppTestConfig(viteConfig, {
  app: 'web',
  environment: 'jsdom',
  setupFiles: ['@vp/web-telemetry/off.setup'],
});
