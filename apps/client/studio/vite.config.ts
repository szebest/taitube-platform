import { clientAppConfig } from '@kit/vite-preset';

export default clientAppConfig({
  configUrl: import.meta.url,
  port: 5174,
  entryBudgetKb: 128,
  // 116: share-link, password, test and pipeline contracts and copy ship in the first load (496.5 KB measured)
  initialBudgetKb: 497,
});
