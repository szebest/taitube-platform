import { expect } from '../../../../../tests/playwright/fixtures';
import { describeSecurityHeaders } from '../../../../../tests/playwright/security/headers';
import { videoCard } from '../video-card';

describeSecurityHeaders({
  pages: [
    { name: 'the home page', path: () => '/' },
    { name: 'a watch page', path: ({ videos }) => `/watch/${videos.watchable.id}` },
  ],
  hydrated: {
    path: () => '/',
    ready: async (page, { videos }) => {
      await videoCard(page, videos.watchable.id).click();
      await expect(page.getByRole('heading', { name: videos.watchable.title })).toBeVisible();
    },
  },
});
