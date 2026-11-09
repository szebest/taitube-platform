import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base, {
  expect: { timeout: 90_000, toHaveScreenshot: base.expect?.toHaveScreenshot },
});
