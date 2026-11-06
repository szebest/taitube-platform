import { clientAppTestConfig } from '@vp/vite-preset/vitest';
import viteConfig from './vite.config';

/** The differential specs once more without the React Compiler, against the same snapshots. */
export default await clientAppTestConfig(viteConfig, {
  app: 'studio',
  environment: 'jsdom',
  setupFiles: ['@vp/web-telemetry/off.setup'],
  compiler: false,
  include: ['src/**/__tests__/**/*.differential.dom.test.tsx'],
});
