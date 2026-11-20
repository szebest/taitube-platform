import { clientAppTestConfig } from '@kit/vite-preset/vitest';
import { JSDOM_SETUP_FILES, SPEC_ENV } from '@vp/web-testing/setup-files';
import viteConfig from './vite.config';

/** The differential specs once more without the React Compiler, against the same snapshots. */
export default await clientAppTestConfig(viteConfig, {
  app: 'studio',
  environment: 'jsdom',
  setupFiles: ['@kit/web-telemetry/off.setup', ...JSDOM_SETUP_FILES],
  env: SPEC_ENV,
  compiler: false,
  include: ['src/**/__tests__/**/*.differential.dom.test.tsx'],
});
