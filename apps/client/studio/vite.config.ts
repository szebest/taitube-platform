import { fileURLToPath } from 'node:url';
import { clientAppConfig } from '@kit/vite-preset';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5174,
  packagesDir: fileURLToPath(new URL('../../../packages', import.meta.url)),
  entryBudgetKb: 128,
  // 116 with 129: share-link, password, test and pipeline contracts and copy ship in the first load, with the formatter kinds, list parts and the more-disclosure popover (506.2 KB measured after the merge with 170)
  initialBudgetKb: 509,
  flaggedDirs: [{ dir: 'demo-personas', env: 'VITE_DEMO_PERSONAS' }],
});
