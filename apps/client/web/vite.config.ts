import { fileURLToPath } from 'node:url';
import { clientAppConfig } from '@kit/vite-preset';
import { OFFLINE_PAGE_URL } from './src/integrations/service-worker/offline-page';
import { pwaPlugins } from './vite-pwa.config';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5173,
  packagesDir: fileURLToPath(new URL('../../../packages', import.meta.url)),
  entryBudgetKb: 144,
  // 116 with 129: share-link, password, test and pipeline contracts and copy ship in the first load (551.6 KB on main); 119 adds playlist collaboration contracts, errors and copy (555.8 KB on 119a, 558.4 KB with 119b's share-link contracts, 567.0 KB with 119c's playlist page copy, about 5.4 KB of it, which the catalogue ships eagerly, 567.9 KB with the custom cover upload's)
  // 120: the post, comment-target and thread contracts and their copy ship in the first load (553.7 KB measured)
  // 120c: the posts surfaces and the viewer threads copy and wiring ship in the first load (569.2 KB measured)
  // 171: the formatter kinds, list parts and the more-disclosure popover ship in the first load (571.1 KB measured on 171 alone)
  // 119 with 120: the playlist and post contracts, errors and copy ship together in the first load (585.2 KB measured on the merge)
  initialBudgetKb: 587,
  flaggedDirs: [{ dir: 'demo-personas', env: 'VITE_DEMO_PERSONAS' }],
  forbiddenDirs: ['src/modules/Upload', 'src/features/upload', 'src/routes/_authed/upload'],
  plugins: pwaPlugins,
  prerender: [OFFLINE_PAGE_URL],
});
