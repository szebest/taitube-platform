import type { Page } from '../../../../tests/playwright/fixtures';

/** A seeded video's card link; the home feed can show one video on several shelves, so the first. */
export function videoCard(page: Page, videoId: string) {
  return page.locator(`[data-slot="video-card"] a[href="/watch/${videoId}"]`).first();
}
