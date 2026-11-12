import { expect, hydrated, type Page, type Persona, type Stack, test } from './fixtures';

export type ExitingOverlay = Readonly<{
  name: string;
  open: (page: Page) => Promise<void>;
  close: (page: Page) => Promise<void>;
  /** The selector of the surface that must stay in the document, closing, between the close and its removal. */
  surface: string;
  width?: number;
}>;

const EXIT_BUDGET_MS = 1000;

type Exit = { closing: boolean; gone: boolean };

/**
 * Watches `selector` in the page: `closing` once it is in the document with `data-state="closed"` at the end
 * of a task, `gone` once it left after that. A surface removed as it closes, with no exit, is never `closing`.
 */
function watchExit(page: Page, selector: string) {
  return page.evaluate((watched) => {
    const exit: Exit = { closing: false, gone: false };
    Object.assign(window, { overlayExit: exit });
    new MutationObserver(() => {
      const surface = document.querySelector(watched);
      if (surface?.getAttribute('data-state') === 'closed') exit.closing = true;
      else if (!surface && exit.closing) exit.gone = true;
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
  }, selector);
}

const readExit = (page: Page) =>
  page.evaluate(() => (window as unknown as { overlayExit: Exit }).overlayExit);

/** An overlay animates out: it stays in the document, `data-state="closed"`, after the close and before it is gone. */
export function describeOverlayExit(
  path: string | ((stack: Stack) => string),
  persona: Persona,
  overlays: readonly ExitingOverlay[]
): void {
  test.describe('an overlay closing', () => {
    for (const overlay of overlays) {
      test(`${overlay.name} animates out`, async ({ page, signIn, stack }) => {
        await signIn(persona);
        await page.setViewportSize({ width: overlay.width ?? 1280, height: 800 });
        await page.goto(typeof path === 'string' ? path : path(stack));
        await hydrated(page.locator('main'));
        await overlay.open(page);
        await expect(page.locator(overlay.surface)).toBeVisible();
        await watchExit(page, overlay.surface);

        await overlay.close(page);

        await expect
          .poll(() => readExit(page), { timeout: EXIT_BUDGET_MS })
          .toEqual({ closing: true, gone: true });
      });
    }
  });
}
