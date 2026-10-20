import { type Page, expect } from '@playwright/test';

/** `ink.50`, as the minified production CSS writes it. */
const NOCTURNE_LIGHT_GROUND = '#f5f7fa';

const rootProperty = (page: Page, name: string) =>
  page.evaluate(
    (property) => getComputedStyle(document.documentElement).getPropertyValue(property).trim(),
    name
  );

/**
 * Opens `path`, then picks Nocturne, light mode and the other density from the app's appearance
 * menu, and holds that each one changes the computed variables while the page never reloads.
 */
export async function switchAppearance(
  page: Page,
  path: string,
  { startsCompact }: Readonly<{ startsCompact: boolean }>
): Promise<void> {
  await page.goto(path, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    document.documentElement.dataset.sameDocument = 'true';
  });
  const pick = async (name: string) => {
    await page.getByRole('button', { name: 'Appearance' }).click();
    await page.getByRole('menuitemradio', { name }).click();
  };
  // Bootstrap's reboot squares every <button>: a round one proves the utilities still win over it.
  const menu = page.getByRole('button', { name: 'Appearance' });
  await expect(menu).not.toHaveCSS('border-top-left-radius', '0px');
  const sandGround = await rootProperty(page, '--bg');
  const startingGap = await rootProperty(page, '--gap-stack');

  await pick('Nocturne');
  await expect.poll(() => rootProperty(page, '--bg')).not.toBe(sandGround);
  await pick('Light');
  await expect.poll(() => rootProperty(page, '--bg')).toBe(NOCTURNE_LIGHT_GROUND);
  await pick(startsCompact ? 'Comfortable' : 'Compact');
  await expect.poll(() => rootProperty(page, '--gap-stack')).not.toBe(startingGap);

  await expect(page.locator('html')).toHaveAttribute('data-same-document', 'true');
}
