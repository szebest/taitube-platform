import type { Locator } from '@playwright/test';
import { expect, type Page } from './fixtures';

export const OVERLAY_WIDTHS = [320, 375, 768, 1280];

/** What an open overlay holds at a width: inside the viewport, no wider than its content, and no page scroll sideways. */
export async function expectOverlayFits(page: Page, overlay: Locator, width: number) {
  await expect(overlay).toBeVisible();
  const box = await overlay.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  expect(await overlay.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBe(0);
}
