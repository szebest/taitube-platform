import { describeHorizontalOverflow } from '../../../../tests/playwright/horizontal-overflow';

describeHorizontalOverflow('viewer', [
  '/',
  '/search?q=launch',
  '/search?q=launch&type=channel',
  '/settings',
  '/shorts',
  (stack) => `/watch/${stack.videos.watchable.id}`,
]);
