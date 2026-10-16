import { type Page, expect } from '../fixtures';

/** No payload ran: nothing set the global every payload writes, and no element of theirs exists. */
export async function expectNothingRan(page: Page): Promise<void> {
  expect(await page.evaluate(() => Reflect.get(window, '__xss'))).toBeUndefined();
  await expect(page.locator('a[href^="javascript:"], img[src="x"], svg[onload]')).toHaveCount(0);
}
