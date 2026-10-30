import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { appearance } from '@vp/ui/appearance/registry';
import { THEME_DEFAULT } from '../src/toolbars';
import { type StoryEntry, shotsFor, storiesFor } from './stories';

declare global {
  interface Window {
    __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } };
  }
}

const SHOWN_MODES = ['dark', 'light', 'oled'];

const index: { entries: Record<string, StoryEntry> } = JSON.parse(
  readFileSync(new URL('../storybook-static/index.json', import.meta.url), 'utf8')
);

/** A pull request lists what it changed, one path per line; main gives no list and shoots all. */
const changedList = process.env.VISUAL_CHANGED_FILES;
const changed = changedList
  ? readFileSync(changedList, 'utf8')
      .split('\n')
      .filter((line) => line !== '')
  : undefined;

const shots = shotsFor(storiesFor(Object.values(index.entries), changed), {
  themes: appearance.themes.map(({ id }) => id),
  modes: SHOWN_MODES,
  pullRequest: changed !== undefined,
});

for (const { story, theme, mode, motion = THEME_DEFAULT } of shots) {
  const reduced = motion === 'reduced' ? '-reduced' : '';
  test(`${story} at ${theme} ${mode}${reduced}`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=${story}&viewMode=story&globals=theme:${theme};mode:${mode};motion:${motion}`
    );
    const root = page.locator('#storybook-root');
    await expect(root.locator(':scope > *').first()).toBeAttached();
    await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
    await page.waitForFunction(() => {
      const phase = window.__STORYBOOK_PREVIEW__?.currentRender?.phase;
      return phase === 'finished' || phase === 'errored' || phase === 'aborted';
    });
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot(`${story}/${theme}-${mode}${reduced}.png`);
  });
}
