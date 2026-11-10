import { describeHorizontalOverflow } from '../../../../tests/playwright/horizontal-overflow';

describeHorizontalOverflow('creator', [
  '/videos',
  (stack) => `/videos/${stack.videos.watchable.id}/edit`,
  '/analytics',
  '/customization',
]);

describeHorizontalOverflow(
  'creator',
  [
    '/videos',
    (stack) => `/videos/${stack.videos.watchable.id}/edit`,
    '/analytics',
    '/customization',
    '/admin/categories',
  ],
  [768, 1280]
);
