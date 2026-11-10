import { describeLayoutStability } from '../../../../tests/playwright/layout-stability';

describeLayoutStability('/videos', 'creator', [
  {
    name: 'the account menu',
    open: (page) => page.getByRole('button', { name: 'Account' }).click(),
    close: (page) => page.keyboard.press('Escape'),
  },
  {
    name: 'the upload dialog',
    open: (page) =>
      page
        .getByRole('button', { name: /upload/i })
        .first()
        .click(),
    close: (page) => page.keyboard.press('Escape'),
  },
]);
