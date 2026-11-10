import { expect, test } from '../../../../tests/playwright/fixtures';
import { expectOverlayFits, OVERLAY_WIDTHS } from '../../../../tests/playwright/overlay-fit';

const PHONE_MAX = 599;

for (const width of OVERLAY_WIDTHS) {
  test(`the share dialog fits at ${width} px and is a drawer on a phone`, async ({
    page,
    signIn,
    stack,
  }) => {
    await signIn('viewer');
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/watch/${stack.videos.watchable.id}`, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: 'Share' }).click();

    const dialog = page.getByRole('dialog', { name: 'Share this video' });
    await expectOverlayFits(page, dialog, width);
    await expect(dialog).toHaveAttribute(
      'data-slot',
      width <= PHONE_MAX ? 'drawer-content' : 'dialog-content'
    );
  });
}
