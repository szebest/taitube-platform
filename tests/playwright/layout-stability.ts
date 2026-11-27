import type { Locator } from '@playwright/test';
import { expect, hydrated, type Page, type Persona, type Stack, test } from './fixtures';

export type LockingOverlay = Readonly<{
  name: string;
  open: (page: Page) => Promise<void>;
  close: (page: Page) => Promise<void>;
  /** The control `open` clicks, when it sits in the page: it is scrolled into view before the measure. */
  trigger?: (page: Page) => Locator;
  width?: number;
}>;

const SCROLLED_TO = 700;
const CLASSIC_SCROLLBAR_MIN_PX = 10;

const measure = (page: Page) =>
  page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect && { left: rect.left, width: rect.width, top: Math.round(rect.top + scrollY) };
    };
    return { scrollY: Math.round(scrollY), main: box('main'), header: box('header') };
  });

/**
 * Every locking primitive opens and closes over a page with a classic 15 px scrollbar without moving
 * the content's box or the scroll position: the headless browser's `--hide-scrollbars` is dropped and
 * a styled `::-webkit-scrollbar` takes the room where macOS draws an overlay one.
 */
export function describeLayoutStability(
  path: string | ((stack: Stack) => string),
  persona: Persona,
  overlays: readonly LockingOverlay[]
): void {
  test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });
  test.describe('a locking overlay', () => {
    for (const overlay of overlays) {
      test(`${overlay.name} leaves the content where it was`, async ({ page, signIn, stack }) => {
        await signIn(persona);
        await page.setViewportSize({ width: overlay.width ?? 1280, height: 800 });
        await page.goto(typeof path === 'string' ? path : path(stack), {
          waitUntil: 'networkidle',
        });
        await hydrated(overlay.trigger?.(page) ?? page.locator('main'));
        await page.addStyleTag({
          content:
            'body { min-height: 3000px; } html::-webkit-scrollbar { width: 15px; } html::-webkit-scrollbar-thumb { background: #888; }',
        });
        await page.evaluate((top) => scrollTo(0, top), SCROLLED_TO);
        await overlay.trigger?.(page).scrollIntoViewIfNeeded();
        const scrollbar = await page.evaluate(
          () => innerWidth - document.documentElement.clientWidth
        );
        expect(scrollbar, 'a classic scrollbar takes room').toBeGreaterThan(
          CLASSIC_SCROLLBAR_MIN_PX
        );
        const before = await measure(page);
        expect(before.scrollY).toBeGreaterThan(0);

        await overlay.open(page);
        await expect(page.locator('body[data-scroll-locked]')).toHaveCount(1);
        expect(await measure(page)).toEqual(before);

        await overlay.close(page);
        await expect(page.locator('body[data-scroll-locked]')).toHaveCount(0);
        expect(await measure(page)).toEqual(before);
      });
    }
  });
}
