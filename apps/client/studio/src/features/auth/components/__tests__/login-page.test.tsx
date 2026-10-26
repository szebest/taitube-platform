import { serverRender } from '@vp/web-testing/server';

import { getRouter } from '#app/router';

describe('apps/client/studio: login page', () => {
  it.each([
    { url: '/login', expired: false },
    { url: '/login?reason=expired', expired: true },
  ])(
    'titles the studio sign-in, and says the session ended only when it did: $url',
    async ({ url, expired }) => {
      const { html } = await serverRender(getRouter, url);

      expect(html).toContain('Sign in to the studio');
      expect(html.includes('Your session ended. Sign in again to carry on.')).toBe(expired);
    }
  );
});
