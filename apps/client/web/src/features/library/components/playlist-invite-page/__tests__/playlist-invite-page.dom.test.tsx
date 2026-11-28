import { screen, waitFor } from '@testing-library/react';
import { acceptPlaylistInvite, declinePlaylistInvite } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';

const JOINED = uuid(4300);
const TOKEN = 'invite-token';

const renderInvite = (search = '', handlers: HttpHandler[] = []) =>
  renderLibrary(`/playlist-invite/${TOKEN}${search}`, {
    details: [playlistDetail(JOINED, [], { title: 'Study group' })],
    handlers,
  });

describe('apps/client/web: the playlist invite page', () => {
  it('accepts the invite and opens the playlist it seats the viewer on', async () => {
    const accepted: string[] = [];
    const { user, router } = await renderInvite('', [
      mockEndpoint(acceptPlaylistInvite, ({ params }) => {
        accepted.push(String(params.token));
        return HttpResponse.json({ playlistId: JOINED, role: 'editor' });
      }),
    ]);

    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(router.state.location.search).toMatchObject({ list: JOINED }));
    expect(accepted).toEqual([TOKEN]);
    expect(await screen.findByText('You joined the playlist')).toBeInTheDocument();
  });

  it('declines a personal invite opened from its notification', async () => {
    const { user, router } = await renderInvite('?via=notification', [
      mockEndpoint(declinePlaylistInvite, () => new HttpResponse(null, { status: 204 })),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('says an expired or used up invite cannot be used', async () => {
    const { user } = await renderInvite('', [
      mockEndpoint(acceptPlaylistInvite, () => problemReply(ErrorCodes.PLAYLIST_INVITE_INVALID)),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Accept' }));

    expect(
      await screen.findByRole('heading', { name: 'This invite has expired or was used up' })
    ).toBeInTheDocument();
  });
});
