import { expect, test } from '../../../../tests/playwright/fixtures';
import { CLS_BUDGET, observeVitals, readVitals } from '../../../../tests/playwright/vitals';

test(`the home page shifts the layout by less than ${CLS_BUDGET}`, async ({ page }) => {
  await observeVitals(page);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const { cls } = await readVitals(page);
  test.info().annotations.push({ type: 'cls', description: String(cls) });
  expect(cls).toBeLessThan(CLS_BUDGET);
});
