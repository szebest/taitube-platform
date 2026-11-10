import { describeHorizontalOverflow } from '../../../../tests/playwright/horizontal-overflow';

describeHorizontalOverflow('creator', [
  '/videos',
  (stack) => `/videos/${stack.videos.watchable.id}/edit`,
  '/analytics',
  '/customization',
]);

describeHorizontalOverflow(
  'creator',
  [(stack) => `/videos/${stack.videos.watchable.id}/edit`],
  [768, 1280]
);
