import { expect } from '../../../../../tests/playwright/fixtures';
import { describeSecurityHeaders } from '../../../../../tests/playwright/security/headers';

describeSecurityHeaders({
  pages: [
    { name: 'the library', path: () => '/videos' },
    { name: 'the upload route', path: () => '/upload' },
    { name: 'an edit page', path: ({ videos }) => `/videos/${videos.draft.id}/edit` },
  ],
  hydrated: {
    signIn: 'creator',
    path: () => '/upload',
    ready: async (page) => {
      await expect(page.getByRole('dialog', { name: 'Upload a video' })).toBeVisible();
    },
  },
});
