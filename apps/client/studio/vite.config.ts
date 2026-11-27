import { fileURLToPath } from 'node:url';
import { clientAppConfig } from '@kit/vite-preset';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5174,
  packagesDir: fileURLToPath(new URL('../../../packages', import.meta.url)),
  entryBudgetKb: 128,
  // 116 with 129 and 120: share-link, password, test, pipeline, post and thread contracts and copy ship in the first load (497.5 KB measured on slice b)
  initialBudgetKb: 500,
  flaggedDirs: [{ dir: 'demo-personas', env: 'VITE_DEMO_PERSONAS' }],
});
