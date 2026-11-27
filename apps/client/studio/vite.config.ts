import { clientAppConfig } from '@kit/vite-preset';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5174,
  entryBudgetKb: 128,
  // 116 with 129 and 120: share-link, password, test, pipeline, post and thread contracts and copy ship in the first load (497.5 KB measured on 120 slice b); 119 adds playlist collaboration contracts, errors and domain types (499.5 KB on 119a, 502.2 KB with 119b's share-link contracts)
  initialBudgetKb: 506,
  flaggedDirs: [{ dir: 'demo-personas', env: 'VITE_DEMO_PERSONAS' }],
});
