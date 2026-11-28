import { screen, waitFor } from '@testing-library/react';
import { acceptPlaylistInvite, declinePlaylistInvite } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { failureCode } from '@vp/queries';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { renderPart } from '#app/features/library/__tests__/render-playlist';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useAnswerPlaylistInvite } from '../use-answer-playlist-invite';

const TOKEN = 'invite-token';
const JOINED = uuid(4300);

function Answer() {
  const { mutate, error } = useAnswerPlaylistInvite(TOKEN);
  return (
    <>
      <button onClick={() => mutate('accept')}>Accept</button>
      <button onClick={() => mutate('decline')}>Decline</button>
      {error && <p>{failureCode(error)}</p>}
    </>
  );
}

async function renderAnswer(
  accept: () => Response = () => HttpResponse.json({ playlistId: JOINED, role: 'editor' })
) {
  const answered: string[] = [];
  const client = createQueryClient();
  client.setQueryData(libraryKeys.playlists(), { items: [] });
  const rendered = await renderPart(<Answer />, {
    client,
    handlers: [
      mockEndpoint(acceptPlaylistInvite, ({ params }) => {
        answered.push(`accept ${params.token}`);
        return accept();
      }),
      mockEndpoint(declinePlaylistInvite, ({ params }) => {
        answered.push(`decline ${params.token}`);
        return new HttpResponse<null>(null, { status: 204 });
      }),
    ],
  });
  return { ...rendered, answered };
}

describe('apps/client/web: useAnswerPlaylistInvite', () => {
  it('accepting says so, opens the playlist joined and marks the library stale', async () => {
    const { user, router, client, answered } = await renderAnswer();

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByText('You joined the playlist')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.search).toMatchObject({ list: JOINED }));
    expect(router.state.location.pathname).toBe('/playlist');
    expect(answered).toEqual([`accept ${TOKEN}`]);
    expect(client.getQueryState(libraryKeys.playlists())?.isInvalidated).toBe(true);
  });

  it('declining says so and goes home', async () => {
    const { user, router, answered } = await renderAnswer();

    await user.click(screen.getByRole('button', { name: 'Decline' }));

    expect(await screen.findByText('Invite declined')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(answered).toEqual([`decline ${TOKEN}`]);
  });

  it('keeps a dead invite as the error and goes nowhere', async () => {
    const { user, router } = await renderAnswer(() =>
      problemReply(ErrorCodes.PLAYLIST_INVITE_INVALID)
    );

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByText(ErrorCodes.PLAYLIST_INVITE_INVALID)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByText('You joined the playlist')).not.toBeInTheDocument();
  });
});
