import { describeLayoutStability } from '../../../../tests/playwright/layout-stability';

describeLayoutStability('/search', 'viewer', [
  {
    name: 'the search palette',
    open: (page) => page.keyboard.press('/'),
    close: (page) => page.keyboard.press('Escape'),
  },
  {
    name: 'the account menu',
    open: (page) => page.getByRole('button', { name: 'Account' }).click(),
    close: (page) => page.keyboard.press('Escape'),
  },
  {
    name: 'the navigation drawer',
    width: 375,
    open: (page) => page.getByRole('button', { name: 'Menu' }).click(),
    close: (page) => page.keyboard.press('Escape'),
  },
]);

describeLayoutStability('/settings/language', 'viewer', [
  {
    name: 'a select',
    open: async (page) => {
      await page
        .getByRole('combobox')
        .evaluate((trigger) => trigger.focus({ preventScroll: true }));
      await page.keyboard.press('Enter');
    },
    close: (page) => page.keyboard.press('Escape'),
  },
]);

describeLayoutStability((stack) => `/watch/${stack.videos.watchable.id}`, 'viewer', [
  {
    name: 'the share dialog',
    trigger: (page) => page.getByRole('button', { name: 'Share' }),
    open: (page) => page.getByRole('button', { name: 'Share' }).click(),
    close: (page) => page.keyboard.press('Escape'),
  },
]);
