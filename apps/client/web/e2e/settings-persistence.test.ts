import { expect, test } from '../../../../tests/playwright/fixtures';

test.describe('a guest keeps settings on the device, and the sign-in carries them over', () => {
  test('roundness and spacing survive a reload with no theme flash, playback comes from storage', async ({
    page,
  }) => {
    await page.goto('/settings/appearance', { waitUntil: 'networkidle' });
    await page.getByRole('radio', { name: 'Sharp' }).click();
    await page.getByRole('radio', { name: 'Compact' }).click();

    await page.goto('/settings/playback', { waitUntil: 'networkidle' });
    await page.getByRole('switch', { name: 'Hover play' }).click();

    const served = await (await page.request.get('/settings/playback')).text();
    expect(served).toContain('data-radius="sharp"');
    await page.reload({ waitUntil: 'networkidle' });

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-radius', 'sharp');
    await expect(html).toHaveAttribute('data-spacing', 'compact');
    await expect(page.getByRole('switch', { name: 'Hover play' })).not.toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('vp.prefs.device'))).toContain(
      '"hoverPlay":false'
    );
    expect(
      (await page.context().cookies()).find(({ name }) => name === 'vp.device')?.value ?? ''
    ).not.toContain('hoverPlay');
  });

  test('two tabs agree through the broadcast channel', async ({ context, page }) => {
    await page.goto('/settings/playback', { waitUntil: 'networkidle' });
    const other = await context.newPage();
    await other.goto('/settings/playback', { waitUntil: 'networkidle' });

    await page.getByRole('switch', { name: 'Stats overlay' }).click();

    await expect(other.getByRole('switch', { name: 'Stats overlay' })).toBeChecked();
  });

  test('a viewer signing in keeps the field changed here, and says so', async ({
    page,
    api,
    signIn,
  }) => {
    const viewer = await api('viewer');
    await viewer.patch('/v1/me/preferences', {
      data: { version: 0, playback: { speed: 2 } },
    });
    await page.goto('/settings/playback', { waitUntil: 'networkidle' });
    await page.getByRole('combobox', { name: 'Default speed' }).click();
    await page.getByRole('option', { name: '1.5x' }).click();

    await signIn('viewer');
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.getByText('Kept your choice for Speed', { exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Default speed' })).toContainText('1.5x');
  });
});
