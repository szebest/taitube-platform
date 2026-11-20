import { type Page, expect, test } from '../../../../tests/playwright/fixtures';

/** The cold and warm budgets from activating a row to the new identity's page painted. */
const COLD_MS = 1000;
const WARM_MS = 300;

/** What the throttled API adds to every call, as a slow network would. */
const API_LATENCY_MS = 150;

async function throttleApi(page: Page, latency = API_LATENCY_MS) {
  await page.route('**/api/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, latency));
    await route.continue();
  });
}

/** Counts every document load from here on, which an in-place switch must never cause. */
async function countLoads(page: Page) {
  await page.evaluate(() => {
    Reflect.set(window, '__loads', 0);
    window.addEventListener('load', () =>
      Reflect.set(window, '__loads', Number(Reflect.get(window, '__loads')) + 1)
    );
  });
  return async () => ({
    loads: await page.evaluate(() => Number(Reflect.get(window, '__loads'))),
    navigations: await page.evaluate(() => performance.getEntriesByType('navigation').length),
    history: await page.evaluate(() => history.length),
  });
}

async function switchTo(page: Page, name: string) {
  await page.getByRole('button', { name: 'Account' }).click();
  const row = page.getByRole('menuitemradio', { name: new RegExp(name) });
  await row.hover();
  const started = Date.now();
  await row.click();
  await expect(
    page.locator('[aria-live="polite"]').filter({ hasText: `Now browsing as ${name}` })
  ).toBeAttached();
  return Date.now() - started;
}

test.describe('several accounts in one browser', () => {
  test('a tab with no prefix opens as the default, and every URL then names its slot', async ({
    page,
    signInSlots,
  }) => {
    const [creator] = await signInSlots(['creator', 'viewer']);

    await page.goto('/feed/trending');

    await expect(page).toHaveURL(/\/u\/0\/feed\/trending$/);
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page.getByRole('menuitemradio', { checked: true })).toContainText(creator ?? '');
  });

  test('switches mid-page with a slow API in place: no reload, no stale data, the new identity at once', async ({
    page,
    signInSlots,
  }) => {
    const [creator = '', viewer = ''] = await signInSlots(['creator', 'viewer']);
    await page.goto('/feed/you');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const after = await countLoads(page);
    const before = await after();
    await page.route('**/api/**', async (route) => {
      if (route.request().headers()['x-account-slot'] === '0') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      await route.continue();
    });

    await switchTo(page, viewer);

    await expect(page).toHaveURL(/\/u\/1\/feed\/you$/);
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page.getByRole('menuitemradio', { checked: true })).toContainText(viewer);
    await expect(page.getByRole('main')).not.toContainText(creator);
    expect(await after()).toEqual({ loads: 0, navigations: 1, history: before.history });
  });

  test('switches within the speed target: 1 s cold and 300 ms warm with the API throttled', async ({
    page,
    signInSlots,
  }) => {
    const [creator = '', viewer = ''] = await signInSlots(['creator', 'viewer']);
    await page.goto('/feed/trending');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await throttleApi(page);

    const cold = await switchTo(page, viewer);
    const warm: number[] = [];
    for (const name of [creator, viewer, creator, viewer, creator]) {
      await page.getByRole('button', { name: 'Account' }).click();
      await page.getByRole('menuitemradio', { name: new RegExp(name) }).hover();
      await page.waitForTimeout(API_LATENCY_MS * 4);
      await page.keyboard.press('Escape');
      warm.push(await switchTo(page, name));
    }
    const p95 = warm.toSorted((a, b) => a - b)[Math.ceil(warm.length * 0.95) - 1] ?? 0;

    expect(cold).toBeLessThan(COLD_MS);
    expect(p95).toBeLessThan(WARM_MS);
  });

  test('two tabs on two accounts call the API as two users and keep them over a reload', async ({
    page,
    context,
    signInSlots,
  }) => {
    const [creator = '', viewer = ''] = await signInSlots(['creator', 'viewer']);
    const other = await context.newPage();

    await page.goto('/u/0/feed/trending');
    await other.goto('/u/1/feed/trending');
    await other.reload();

    for (const [tab, name] of [
      [page, creator],
      [other, viewer],
    ] as const) {
      await tab.getByRole('button', { name: 'Account' }).click();
      await expect(tab.getByRole('menuitemradio', { checked: true })).toContainText(name);
      await tab.keyboard.press('Escape');
    }
  });

  test('an expired slot reads as expired with its way back, and the other keeps working', async ({
    page,
    context,
    signInSlots,
  }) => {
    const [creator = ''] = await signInSlots(['creator', 'viewer']);
    await context.clearCookies({ name: 'vp.session.1' });

    await page.goto('/u/0/feed/trending');
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('menuitemradio', { name: /Session expired, sign in/ }).click();

    await expect(page).toHaveURL(/\/login\?.*slot=1/);
    await page.goto('/u/0/feed/you');
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page.getByRole('menuitemradio', { checked: true })).toContainText(creator);
  });

  test('signs out of one account, the other staying, then out of all', async ({
    page,
    context,
    signInSlots,
  }) => {
    const [, viewer = ''] = await signInSlots(['creator', 'viewer']);
    await page.goto('/u/0/feed/trending');

    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('menuitem', { name: 'Sign out of this account' }).click();

    await expect(page).toHaveURL(/\/feed\/trending$/);
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page.getByRole('menuitemradio', { checked: true })).toContainText(viewer);
    const names = (await context.cookies()).map(({ name }) => name);
    expect(names).toContain('vp.session.1');
    expect(names).not.toContain('vp.session.0');

    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();
    expect((await context.cookies()).map(({ name }) => name)).not.toContain('vp.session.1');
  });

  test('a studio link opens the studio as the same account', async ({ page, signInSlots }) => {
    await signInSlots(['creator', 'viewer']);
    await page.goto('/u/1/feed/trending');

    await page.getByRole('button', { name: 'Account' }).click();
    const upload = page.getByRole('menuitem', { name: 'Upload' });

    await expect(upload).toHaveAttribute('href', /\/u\/1\/upload$/);
  });

  test('on a phone the account button opens the bottom sheet, and so does a long press on You', async ({
    page,
    signInSlots,
  }) => {
    const [, viewer = ''] = await signInSlots(['creator', 'viewer']);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/u/0/');

    await page.getByRole('button', { name: 'Account' }).click();
    const sheet = page.getByRole('dialog', { name: 'Switch account or channel' });
    await expect(sheet.getByRole('option', { name: new RegExp(viewer) })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    const you = page
      .getByRole('navigation', { name: 'Main' })
      .last()
      .getByRole('link', { name: 'You' });
    const box = await you.boundingBox();
    if (!box) throw new Error('the You tab is not on screen');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();

    await expect(sheet).toBeVisible();
  });
});
