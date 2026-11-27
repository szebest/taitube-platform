import { clientAppConfig } from '@kit/vite-preset';
import { OFFLINE_PAGE_URL } from './src/integrations/service-worker/offline-page';
import { pwaPlugins } from './vite-pwa.config';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5173,
  entryBudgetKb: 144,
  // 116 with 129: share-link, password, test and pipeline contracts and copy ship in the first load (551.6 KB measured)
  // 120: the post, comment-target and thread contracts and their copy ship in the first load (553.7 KB measured)
  // 120c: the posts surfaces and the viewer threads copy and wiring ship in the first load (568.8 KB measured)
  initialBudgetKb: 570,
  flaggedDirs: [{ dir: 'demo-personas', env: 'VITE_DEMO_PERSONAS' }],
  forbiddenDirs: ['src/modules/Upload', 'src/features/upload', 'src/routes/_authed/upload'],
  plugins: pwaPlugins,
  prerender: [OFFLINE_PAGE_URL],
});
