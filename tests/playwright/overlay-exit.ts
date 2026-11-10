import type { Locator } from '@playwright/test';
import { type Page, type Persona, type Stack, expect, test } from './fixtures';

export type ExitingOverlay = Readonly<{
  name: string;
  open: (page: Page) => Promise<void>;
  close: (page: Page) => Promise<void>;
  /** The surface that must still be on screen, closing, a few frames after the close. */
  surface: (page: Page) => Locator;
  width?: number;
}>;

const FRAMES_AFTER_CLOSE_MS = 30;
const EXIT_BUDGET_MS = 1000;

/** An overlay animates out: it is still in the document, `data-state="closed"`, after the close and before it is gone. */
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
        await page.goto(typeof path === 'string' ? path : path(stack), {
          waitUntil: 'networkidle',
        });
        await overlay.open(page);
        const surface = overlay.surface(page);
        await expect(surface).toBeVisible();

        await overlay.close(page);
        await page.waitForTimeout(FRAMES_AFTER_CLOSE_MS);

        await expect(surface).toHaveAttribute('data-state', 'closed', { timeout: 0 });
        await expect(surface).toHaveCount(0, { timeout: EXIT_BUDGET_MS });
      });
    }
  });
}
