import { screen, waitFor, within } from '@testing-library/react';
import { unfollowPlaylist } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { NOW, uuid } from '#app/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';

const LIVE = uuid(4200);
const GONE = uuid(4201);

describe('apps/client/web: the Following shelf', () => {
  it('shows a followed playlist, and one gone private as no longer available that can be dropped', async () => {
    const unfollowed: string[] = [];
    const { user } = await renderLibrary('/feed/you', {
      followed: [
        {
          playlistId: LIVE,
          followedAt: NOW,
          playlist: {
            title: 'Night walks',
            visibility: 'public',
            isSmart: false,
            thumbnailUrl: null,
            videoCount: 12,
            owner: null,
            updatedAt: NOW,
          },
        },
        { playlistId: GONE, followedAt: NOW, playlist: null },
      ],
      handlers: [
        mockEndpoint(unfollowPlaylist, ({ params }) => {
          unfollowed.push(String(params.id));
          return new HttpResponse<null>(null, { status: 204 });
        }),
      ],
    });

    const shelf = within(await screen.findByRole('region', { name: 'Following' }));
    expect(await shelf.findByRole('link', { name: 'Night walks' })).toHaveAttribute(
      'href',
      `/playlist?list=${LIVE}`
    );
    expect(shelf.getByText('12 videos')).toBeInTheDocument();
    expect(shelf.getByText('No longer available')).toBeInTheDocument();

    await user.click(shelf.getByRole('button', { name: 'Unfollow' }));

    await waitFor(() => expect(unfollowed).toEqual([GONE]));
  });

  it('says what will show up while nothing is followed', async () => {
    await renderLibrary('/feed/you');

    const shelf = within(await screen.findByRole('region', { name: 'Following' }));
    expect(await shelf.findByText('Playlists you follow show up here')).toBeInTheDocument();
  });
});
