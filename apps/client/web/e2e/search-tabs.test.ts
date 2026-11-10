import { expect, test } from '../../../../tests/playwright/fixtures';

const TYPES = ['All', 'Videos', 'Channels', 'Playlists'];

test.describe('the search result tabs', () => {
  test('stay mounted, clickable and counted while another tab loads', async ({ page }) => {
    let releaseChannelPage = () => {};
    const heldChannelPage = new Promise<void>((resolve) => {
      releaseChannelPage = resolve;
    });
    await page.route('**/v1/search?*', async (route) => {
      if (new URL(route.request().url()).searchParams.get('type') !== 'channel') {
        return route.continue();
      }
      await heldChannelPage;
      return route.continue();
    });
    await page.goto('/search?q=launch', { waitUntil: 'networkidle' });
    const tabs = page.getByRole('radiogroup');

    for (const name of TYPES) {
      await expect(page.getByRole('radio', { name: new RegExp(`^${name} \\d`) })).toBeVisible();
    }

    await page.getByRole('radio', { name: /^Channels/ }).click();
    await expect(page.getByRole('radio', { name: /^Channels/ })).toBeChecked();

    await expect(tabs).toBeVisible();
    await expect
      .poll(
        () =>
          page.getByRole('radio', { name: /^Videos/ }).evaluate((tab) => {
            const { x, y, width, height } = tab.getBoundingClientRect();
            return (
              document.elementFromPoint(x + width / 2, y + height / 2)?.closest('[role=radio]') ===
              tab
            );
          }),
        { message: 'the pointer lands on the Videos tab during the load' }
      )
      .toBe(true);

    await page.getByRole('radio', { name: /^Videos/ }).click();
    await expect(page.getByRole('radio', { name: /^Videos/ })).toBeChecked();
    releaseChannelPage();
    for (const name of TYPES) {
      await expect(page.getByRole('radio', { name: new RegExp(`^${name} \\d`) })).toBeVisible();
    }
  });
});
