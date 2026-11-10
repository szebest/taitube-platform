import { expect, test } from '../../../../tests/playwright/fixtures';
import { expectOverlayFits, OVERLAY_WIDTHS } from '../../../../tests/playwright/overlay-fit';

const PHONE_MAX = 599;

for (const width of OVERLAY_WIDTHS) {
  test(`the upload dialog fits at ${width} px and is a drawer on a phone`, async ({
    page,
    signIn,
  }) => {
    await signIn('creator');
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/videos', { waitUntil: 'networkidle' });

    await page
      .getByRole('button', { name: /upload/i })
      .first()
      .click();

    const dialog = page.getByRole('dialog');
    await expectOverlayFits(page, dialog, width);
    await expect(dialog).toHaveAttribute(
      'data-slot',
      width <= PHONE_MAX ? 'drawer-content' : 'dialog-content'
    );
  });
}
