import { expect, test } from '../../../../tests/playwright/fixtures';
import { NARROW_WIDTHS } from '../../../../tests/playwright/horizontal-overflow';

const GUTTER_PX = 8;

for (const width of NARROW_WIDTHS) {
  test(`the upload dialog fits at ${width} px with a gutter`, async ({ page, signIn }) => {
    await signIn('creator');
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/videos', { waitUntil: 'networkidle' });
    await page
      .getByRole('button', { name: /upload/i })
      .first()
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(GUTTER_PX);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width - GUTTER_PX);
    const overflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
