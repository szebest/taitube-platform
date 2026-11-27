import { clientAppConfig } from '@kit/vite-preset';
import { OFFLINE_PAGE_URL } from './src/integrations/service-worker/offline-page';
import { pwaPlugins } from './vite-pwa.config';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5173,
  entryBudgetKb: 144,
  // 116 with 129: share-link, password, test and pipeline contracts and copy ship in the first load (551.6 KB on main); 119 adds playlist collaboration contracts, errors and copy (555.8 KB on 119a, 558.4 KB with 119b's share-link contracts, 567.0 KB with 119c's playlist page copy, about 5.4 KB of it, which the catalogue ships eagerly)
  initialBudgetKb: 568,
  flaggedDirs: [{ dir: 'demo-personas', env: 'VITE_DEMO_PERSONAS' }],
  forbiddenDirs: ['src/modules/Upload', 'src/features/upload', 'src/routes/_authed/upload'],
  plugins: pwaPlugins,
  prerender: [OFFLINE_PAGE_URL],
});
