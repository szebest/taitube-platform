import { waitFor } from '@testing-library/react';
import { followPlaylist, listFollowedPlaylists, unfollowPlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { NOW, uuid } from '#app/__tests__/library-fixtures';
import { libraryKeys } from '#app/lib/query-keys/library-keys';
import { useFollowPlaylist } from '../use-follow-playlist';
import { renderWithToasts } from './toast-harness';

const LIST = uuid(4100);
const OTHER = uuid(4101);
const NO_CONTENT = () => new HttpResponse<null>(null, { status: 204 });
const followed = (playlistId: string) => ({ playlistId, followedAt: NOW, playlist: null });

function renderFollow(
  { pages = [[]], enabled = true, write = NO_CONTENT } = {} as {
    pages?: string[][];
    enabled?: boolean;
    write?: () => Response;
  }
) {
  const asked = vi.fn();
  const writes: string[] = [];
  const stored = pages.map((ids) => [...ids]);
  apiServer.use(
    mockEndpoint(listFollowedPlaylists, ({ request }) => {
      asked();
      const at = Number(new URL(request.url).searchParams.get('cursor') ?? 0);
      return HttpResponse.json({
        items: (stored[at] ?? []).map(followed),
        nextCursor: at + 1 < stored.length ? String(at + 1) : null,
      });
    }),
    mockEndpoint(followPlaylist, () => {
      writes.push('follow');
      const reply = write();
      if (reply.ok) stored[0]?.push(LIST);
      return reply;
    }),
    mockEndpoint(unfollowPlaylist, () => {
      writes.push('unfollow');
      const reply = write();
      if (reply.ok) {
        for (const ids of stored) ids.splice(0, ids.length, ...ids.filter((id) => id !== LIST));
      }
      return reply;
    })
  );
  const client = createQueryClient();
  const { result, show } = renderWithToasts(() => useFollowPlaylist(LIST, enabled), client);
  return { result, show, client, asked, writes };
}

describe('apps/client/web: useFollowPlaylist', () => {
  it.each([
    { case: 'on the first page', pages: [[LIST]], following: true },
    { case: 'on a later page', pages: [[OTHER], [LIST]], following: true },
    { case: 'nowhere', pages: [[OTHER]], following: false },
  ])('knows the playlist is followed or not when it is $case', async ({ pages, following }) => {
    const { result } = renderFollow({ pages });

    await waitFor(() => expect(result.current.following).toBe(following));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it('asks nothing while it is not enabled', async () => {
    const { result, asked } = renderFollow({ pages: [[LIST]], enabled: false });

    expect(result.current.following).toBe(false);
    await new Promise((settle) => setTimeout(settle, 100));
    expect(asked).not.toHaveBeenCalled();
  });

  it.each([
    { from: 'not following', pages: [[]], write: 'follow', following: true },
    { from: 'following', pages: [[LIST]], write: 'unfollow', following: false },
  ])(
    'switches $from at once and marks the followed list stale',
    async ({ pages, write, following }) => {
      const { result, client, writes } = renderFollow({ pages });
      await waitFor(() => expect(result.current.isPending).toBe(false));
      client.setQueryData(libraryKeys.followed(), { pages: [], pageParams: [] });
      await waitFor(() => expect(result.current.following).toBe(!following));

      result.current.toggle();

      await waitFor(() => expect(result.current.following).toBe(following));
      await waitFor(() => expect(writes).toEqual([write]));
      await waitFor(() =>
        expect(client.getQueryState(libraryKeys.followed())?.isInvalidated).toBe(true)
      );
    }
  );

  it('puts the follow back and says so when the server refuses', async () => {
    const { result, show, writes } = renderFollow({
      write: () => problemReply(ErrorCodes.INTERNAL),
    });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    result.current.toggle();

    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' }))
    );
    expect(writes).toEqual(['follow']);
    await waitFor(() => expect(result.current.following).toBe(false));
  });
});
