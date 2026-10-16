import { expect, test } from '../../../../tests/playwright/fixtures';

const PLAYBACK_EVENTS = ['playing', 'timeupdate'];

test.describe('playback', () => {
  test('the video element plays the HLS master of a READY video', async ({ page, stack }) => {
    await page.goto(`/watch/${stack.videos.watchable.id}`);
    const arrived = page.locator('video').evaluate(
      (element, types) =>
        new Promise<string[]>((settle) => {
          const seen = new Set<string>();
          for (const type of types) {
            element.addEventListener(type, () => {
              seen.add(type);
              if (seen.size === types.length) settle([...seen]);
            });
          }
        }),
      PLAYBACK_EVENTS
    );

    await page.getByRole('button', { name: 'Play', exact: true }).first().click();

    expect((await arrived).sort()).toEqual(PLAYBACK_EVENTS);
  });
});
