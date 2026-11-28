import { expect, hydrated, type Page, type Persona, type Stack, test } from './fixtures';

export type ExitingOverlay = Readonly<{
  name: string;
  open: (page: Page) => Promise<void>;
  close: (page: Page) => Promise<void>;
  /** The selector of the surface that must stay in the document, closing, between the close and its removal. */
  surface: string;
  width?: number;
}>;

type Exit = { closing: boolean; animated: boolean; gone: boolean };

/**
 * Watches `selector` in the page and settles `window.overlayExit` once the surface has closed and its exit has
 * run: `closing` when it was in the document with `data-state="closed"` at the end of a task, `animated` when
 * it then had an animation running, `gone` when it left the document two frames after its animations settled
 * (finished or cancelled by the removal). A surface removed as it closes, with no exit, is never `closing`. The page's own animation clock ends the wait, so a busy main thread delays the
 * close and its removal without failing the spec.
 */
function watchExit(page: Page, selector: string) {
  return page.evaluate((watched) => {
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const exit = new Promise<Exit>((resolve) => {
      const observer = new MutationObserver(() => {
        const surface = document.querySelector(watched);
        if (!surface) {
          observer.disconnect();
          resolve({ closing: false, animated: false, gone: true });
          return;
        }
        if (surface.getAttribute('data-state') !== 'closed') return;
        observer.disconnect();
        const animations = surface.getAnimations();
        void Promise.allSettled(animations.map((animation) => animation.finished))
          .then(nextFrame)
          .then(nextFrame)
          .then(() =>
            resolve({ closing: true, animated: animations.length > 0, gone: !surface.isConnected })
          );
      });
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-state'],
      });
    });
    Object.assign(window, { overlayExit: exit });
  }, selector);
}

const readExit = (page: Page) =>
  page.evaluate(() => (window as unknown as { overlayExit: Promise<Exit> }).overlayExit);

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

        expect(await readExit(page)).toEqual({ closing: true, animated: true, gone: true });
      });
    }
  });
}
