import { screen } from '@testing-library/react';
import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '@vp/queries';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

describe('apps/client/web: login in the browser', () => {
  afterEach(() => localStorage.clear());

  it('opens the account menu with the upload entry linking to the studio', async () => {
    localStorage.setItem(AUTH_TOKEN_LOCAL_STORAGE_KEY, 'signed-in');
    const { user } = await renderRoute(getRouter, '/watch/not-a-video', { handlers: loaderApi() });

    await user.click(await screen.findByLabelText('settings'));

    expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute(
      'href',
      'http://localhost:5174/upload'
    );
  });
});
