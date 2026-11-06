import { expect, test } from '../../../../tests/playwright/fixtures';
import { CLS_BUDGET, observeVitals, readVitals } from '../../../../tests/playwright/vitals';

test(`the video library shifts the layout by less than ${CLS_BUDGET}`, async ({ page, signIn }) => {
  await signIn('creator');
  await observeVitals(page);

  await page.goto('/videos');
  await page.getByRole('table', { name: 'Your videos' }).waitFor();
  await page.waitForLoadState('networkidle');

  const { cls } = await readVitals(page);
  test.info().annotations.push({ type: 'cls', description: String(cls) });
  expect(cls).toBeLessThan(CLS_BUDGET);
});
