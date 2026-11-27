import { clientAppTestConfig } from '@kit/vite-preset/vitest';
import { NODE_SETUP_FILES, SPEC_ENV } from '@vp/web-testing/setup-files';
import viteConfig from './vite.config';

export default await clientAppTestConfig(viteConfig, {
  app: 'web',
  environment: 'node',
  setupFiles: ['src/__tests__/live-page.setup.ts', ...NODE_SETUP_FILES],
  env: SPEC_ENV,
});
