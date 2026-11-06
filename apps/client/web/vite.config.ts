import { clientAppConfig } from '@vp/vite-preset';
import { OFFLINE_PAGE_URL } from './src/integrations/service-worker/offline-page';
import { pwaPlugins } from './vite-pwa.config';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5173,
  entryBudgetKb: 144,
  initialBudgetKb: 549,
  forbiddenDirs: ['src/modules/Upload', 'src/features/upload', 'src/routes/_authed/upload'],
  plugins: pwaPlugins,
  prerender: [OFFLINE_PAGE_URL],
});
