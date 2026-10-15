import type { Page } from '../../../../tests/playwright/fixtures';

export function videoCard(page: Page, videoId: string) {
  return page.locator(`a[href="/watch/${videoId}"]`);
}
