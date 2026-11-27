import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { loaderApi } from '#app/__tests__/loader-api';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { getRouter } from '#app/router';

const TOKEN = 'invite-token';

describe('apps/client/web: /playlist-invite/$token', () => {
  it.each([
    { search: '', declines: false },
    { search: '?via=notification', declines: true },
    { search: '?via=somewhere-else', declines: false },
  ])('offers Decline: $declines at $search', async ({ search, declines }) => {
    await renderLibrary(`/playlist-invite/${TOKEN}${search}`);

    expect(await screen.findByRole('heading', { name: 'Join a playlist' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Decline' }) !== null).toBe(declines);
  });

  it('sends a guest to sign in, back to the invite after', async () => {
    const { router } = await renderRoute(getRouter, `/playlist-invite/${TOKEN}`, {
      handlers: loaderApi(),
    });

    expect(router.state.location.href).toBe(`/login?redirect=%2Fplaylist-invite%2F${TOKEN}`);
  });
});
