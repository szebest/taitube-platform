import { clientAppConfig } from '@kit/vite-preset';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5174,
  // 116 with 129: the slice's copy and the failure toast land in the entry (138.2 KB measured)
  entryBudgetKb: 140,
  // 116 with 129: share-link, password, test and pipeline contracts and copy ship in the first load (505.1 KB measured)
  initialBudgetKb: 508,
});
