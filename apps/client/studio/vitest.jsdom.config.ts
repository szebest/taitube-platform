import { clientAppTestConfig } from '@kit/vite-preset/vitest';
import viteConfig from './vite.config';

export default await clientAppTestConfig(viteConfig, {
  app: 'studio',
  environment: 'jsdom',
  setupFiles: ['@kit/web-telemetry/off.setup'],
});
