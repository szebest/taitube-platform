import { clientAppConfig } from '@kit/vite-preset';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5174,
  entryBudgetKb: 128,
  // 116 with 129: share-link, password, test and pipeline contracts and copy ship in the first load (495.3 KB measured)
  initialBudgetKb: 497,
  flaggedDirs: [{ dir: 'demo-personas', env: 'VITE_DEMO_PERSONAS' }],
});
