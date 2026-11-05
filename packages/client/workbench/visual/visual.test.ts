import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { FALLBACK_LOCALE } from '@vp/intl';
import { SUPPORTED_LOCALES } from '@vp/messages';
import { appearance } from '@vp/ui/appearance/registry';
import { THEME_DEFAULT } from '../src/toolbars';
import { type StoryEntry, shotVariant, shotsFor, storiesFor } from './stories';

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
  locales: SUPPORTED_LOCALES.filter((locale) => locale !== FALLBACK_LOCALE),
});

for (const shot of shots) {
  const { story, theme, mode } = shot;
  const { motion = THEME_DEFAULT, direction = 'ltr', locale = FALLBACK_LOCALE } = shot;
  const variant = shotVariant(shot);
  test(`${story} at ${theme} ${mode}${variant}`, async ({ page }) => {
    const globals = `theme:${theme};mode:${mode};motion:${motion};direction:${direction};locale:${locale}`;
    await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=${globals}`);
    const root = page.locator('#storybook-root');
    await expect(root.locator(':scope > *').first()).toBeAttached();
    await expect(page.locator('html')).toHaveAttribute('data-mode', mode);
    await page.waitForFunction(() => {
      const phase = window.__STORYBOOK_PREVIEW__?.currentRender?.phase;
      return (
        phase === 'completing' ||
        phase === 'afterEach' ||
        phase === 'finished' ||
        phase === 'errored' ||
        phase === 'aborted'
      );
    });
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    );
    await page.evaluate(() => {
      const families = new Set(
        [...document.body.querySelectorAll('*')].map(
          (element) => getComputedStyle(element).fontFamily
        )
      );
      return Promise.all([...families].map((family) => document.fonts.load(`1em ${family}`)));
    });
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot(`${story}/${theme}-${mode}${variant}.png`);
  });
}
