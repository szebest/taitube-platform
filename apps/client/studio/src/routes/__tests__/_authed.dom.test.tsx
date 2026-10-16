import { screen } from '@testing-library/react';
import { getAccount } from '@vp/api-contracts';
import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '@vp/queries';
import { account } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { mockEndpoint } from '@vp/web-testing';
import { getRouter } from '#app/router';

describe('apps/client/studio: members-only layout in the browser', () => {
  afterEach(() => localStorage.clear());

  it('asks a guest to sign in on the viewer app, and shows no page', async () => {
    await renderRoute(getRouter, '/upload');

    const prompt = await screen.findByRole('alert');
    expect(prompt).toHaveTextContent('Sign in on Taitube to use the studio');
    expect(prompt.querySelector('a')?.href).toBe('http://localhost:5173/');
    expect(screen.queryByLabelText('Video title')).not.toBeInTheDocument();
  });

  it('shows a signed-in creator the page', async () => {
    localStorage.setItem(AUTH_TOKEN_LOCAL_STORAGE_KEY, 'signed-in');

    await renderRoute(getRouter, '/upload', {
      handlers: [mockEndpoint(getAccount, () => HttpResponse.json(account()))],
    });

    expect(await screen.findByLabelText('Video title')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
