import { type Page, expect, test } from '../../../../tests/playwright/fixtures';

/** Holds every API call of `slot` (all slots when none) until the returned function runs, as a network that does not answer. */
async function holdApi(page: Page, slot?: string) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/**', async (route) => {
    if (slot === undefined || route.request().headers()['x-account-slot'] === slot) await gate;
    await route.continue();
  });
  return release;
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
  await row.click();
  await expect(
    page
      .locator('[aria-live="polite"][data-slot="visually-hidden"]')
      .filter({ hasText: `Now browsing as ${name}` })
  ).toBeAttached();
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
    const release = await holdApi(page, '0');

    await switchTo(page, viewer);

    await expect(page).toHaveURL(/\/u\/1\/feed\/you$/);
    await page.getByRole('button', { name: 'Account' }).click();
    await expect(page.getByRole('menuitemradio', { checked: true })).toContainText(viewer);
    await page.keyboard.press('Escape');
    release();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('main')).not.toContainText(creator);
    expect(await after()).toEqual({ loads: 0, navigations: 1, history: before.history });
  });

  test('switches to an account whose data was fetched ahead without one API answer', async ({
    page,
    signInSlots,
  }) => {
    const [, viewer = ''] = await signInSlots(['creator', 'viewer']);
    await page.goto('/feed/trending');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    await page.getByRole('button', { name: 'Account' }).click();
    const row = page.getByRole('menuitemradio', { name: new RegExp(viewer) });
    const fetchedAhead = Promise.all(
      ['/v1/me/account', '/v1/me/identities', '/v1/me/notifications/unread-count'].map((path) =>
        page.waitForResponse((response) => response.url().endsWith(path))
      )
    );
    await row.hover();
    await fetchedAhead;
    const release = await holdApi(page);
    await row.click();

    await expect(
      page
        .locator('[aria-live="polite"][data-slot="visually-hidden"]')
        .filter({ hasText: `Now browsing as ${viewer}` })
    ).toBeAttached();
    release();
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

    await expect(page).toHaveURL((url) => url.pathname === '/feed/trending');
    // The switch to the slot left swaps the query cache after the URL moves, which closes a menu opened before it settles.
    await expect(async () => {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Account' }).click();
      await expect(page.getByRole('menuitemradio', { checked: true })).toContainText(viewer, {
        timeout: 1_000,
      });
    }).toPass();
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
    await page.clock.install();
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
    await page.clock.fastForward(700);
    await page.mouse.up();

    await expect(sheet).toBeVisible();
  });
});
