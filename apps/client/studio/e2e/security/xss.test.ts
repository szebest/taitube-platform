import { expect, test } from '../../../../../tests/playwright/fixtures';
import { expectNothingRan } from '../../../../../tests/playwright/security/xss';
import { XSS_PAYLOADS } from '../../../../../tests/playwright/xss-payloads';

test.describe('hostile titles and descriptions render as text', () => {
  test('every payload reads as text in the heading and the form on the edit page', async ({
    page,
    signIn,
    stack,
  }) => {
    const { canvas } = stack.videos;
    await signIn('creator');

    await page.goto(`/videos/${canvas.id}/edit`);

    await expect(
      page.getByRole('heading', { name: `Editing video: ${canvas.title}` })
    ).toBeVisible();
    const title = await page.getByLabel('Video title').inputValue();
    const description = await page.getByLabel('Description', { exact: true }).inputValue();
    for (const { kind, payload } of XSS_PAYLOADS) {
      await test.step(kind, () => {
        expect(title).toContain(payload);
        expect(description).toContain(payload);
      });
    }
    await expectNothingRan(page);
  });
});
