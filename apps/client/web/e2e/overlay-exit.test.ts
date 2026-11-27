import type { Page } from '@playwright/test';
import { describeOverlayExit } from '../../../../tests/playwright/overlay-exit';

const escape = (page: Page) => page.keyboard.press('Escape');

describeOverlayExit('/search', 'viewer', [
  {
    name: 'the search palette',
    open: (page) => page.keyboard.press('/'),
    close: escape,
    surface: '[data-slot="command-palette"]',
  },
  {
    name: 'the account menu',
    open: (page) => page.getByRole('button', { name: 'Account' }).click(),
    close: escape,
    surface: '[data-slot="dropdown-menu-content"]',
  },
  {
    name: 'the navigation drawer',
    width: 375,
    open: (page) => page.getByRole('button', { name: 'Menu' }).click(),
    close: escape,
    surface: '[data-slot="drawer-content"]',
  },
]);

describeOverlayExit('/settings/language', 'viewer', [
  {
    name: 'a select',
    open: (page) => page.getByRole('combobox').click(),
    close: escape,
    surface: '[data-slot="select-content"]',
  },
  {
    name: 'a select once an option is chosen',
    open: (page) => page.getByRole('combobox').click(),
    close: (page) => page.getByRole('option', { selected: true }).click(),
    surface: '[data-slot="select-content"]',
  },
]);

describeOverlayExit((stack) => `/watch/${stack.videos.watchable.id}`, 'viewer', [
  {
    name: 'the share dialog',
    open: (page) => page.getByRole('button', { name: 'Share' }).click(),
    close: escape,
    surface: '[data-slot="dialog-content"]',
  },
]);
