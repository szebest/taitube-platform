import { expect } from '../../../../../tests/playwright/fixtures';
import { describeSecurityHeaders } from '../../../../../tests/playwright/security/headers';

describeSecurityHeaders({
  pages: [
    { name: 'the upload page', path: () => '/upload' },
    { name: 'an edit page', path: ({ videos }) => `/upload/edit/${videos.draft.id}` },
  ],
  hydrated: {
    signIn: 'creator',
    path: () => '/upload',
    ready: async (page) => {
      await expect(page.getByLabel('Video title')).toBeVisible();
    },
  },
});
