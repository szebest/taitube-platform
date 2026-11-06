import { screen, waitFor, within } from '@testing-library/react';
import { deletePlaylist, reorderPlaylist, updatePlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';

import {
  libraryVideo,
  playlistDetail,
  uuid,
} from '#app/features/library/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';

const LIST = uuid(4100);
const VIDEOS = [
  libraryVideo(1, 'Tram ride'),
  libraryVideo(2, 'Old film'),
  libraryVideo(3, 'Night bus'),
];
const ITEMS = [uuid(5000), uuid(5001), uuid(5002)];

const renderPlaylist = (
  overrides: Parameters<typeof playlistDetail>[2] = {},
  handlers: HttpHandler[] = []
) =>
  renderLibrary(`/playlist?list=${LIST}`, {
    details: [playlistDetail(LIST, VIDEOS, { description: 'Slow ways home', ...overrides })],
    handlers,
  });

const rowOf = async (title: string) => {
  const card = (await screen.findByRole('link', { name: title })).closest('article');
  if (!card) throw new Error(`no card around ${title}`);
  return within(card);
};

const titles = () =>
  within(screen.getByRole('list', { name: 'Videos in Road trips' }))
    .getAllByRole('article')
    .map(
      (card) => within(card).getByRole('link', { name: /Tram ride|Old film|Night bus/ }).textContent
    );

describe('apps/client/web: /playlist', () => {
  it('renders the hero and the videos in order, each linked with its place in the list', async () => {
    await renderPlaylist({ visibility: 'unlisted' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Road trips' })
    ).toBeInTheDocument();
    expect(screen.getByText('Slow ways home')).toBeInTheDocument();
    expect(screen.getByText(/3 videos.*Unlisted/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play all' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shuffle' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Old film' })).toHaveAttribute(
      'href',
      `/watch/${uuid(2)}?list=${LIST}&index=1`
    );
  });

  it.each([
    { viewer: 'the owner', overrides: {}, shown: true },
    {
      viewer: 'someone else',
      overrides: { ownerId: uuid(9999), visibility: 'public' as const },
      shown: false,
    },
  ])('shows the owner controls to $viewer: $shown', async ({ overrides, shown }) => {
    await renderPlaylist(overrides);

    await screen.findByRole('heading', { level: 1, name: 'Road trips' });

    expect(screen.queryByRole('button', { name: 'Edit details' }) !== null).toBe(shown);
    expect(screen.queryByRole('button', { name: 'Delete playlist' }) !== null).toBe(shown);
    expect(screen.queryAllByRole('button', { name: /^Reorder / }).length > 0).toBe(shown);
  });

  it.each([
    { action: 'Move to top', title: 'Night bus', order: [ITEMS[2], ITEMS[0], ITEMS[1]] },
    { action: 'Move to bottom', title: 'Tram ride', order: [ITEMS[1], ITEMS[2], ITEMS[0]] },
  ])('sends one reorder with the whole new order for $action', async ({ action, title, order }) => {
    const bodies: unknown[] = [];
    const { user } = await renderPlaylist({}, [
      mockEndpoint(reorderPlaylist, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json(playlistDetail(LIST, VIDEOS));
      }),
    ]);

    await user.click((await rowOf(title)).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: action }));

    await waitFor(() => expect(bodies).toEqual([{ itemIds: order }]));
  });

  it('puts the old order back and says so when the reorder is refused', async () => {
    const { user } = await renderPlaylist({}, [
      mockEndpoint(reorderPlaylist, () => problemReply(ErrorCodes.INTERNAL)),
    ]);

    await user.click((await rowOf('Night bus')).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to top' }));

    expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
    await waitFor(() => expect(titles()).toEqual(['Tram ride', 'Old film', 'Night bus']));
  });

  it('edits the details in place', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderPlaylist({}, [
      mockEndpoint(updatePlaylist, async ({ params, request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json(playlistDetail(String(params.id), VIDEOS));
      }),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Edit details' }));
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Night trips');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Night trips' })
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(bodies).toEqual([
        { title: 'Night trips', description: 'Slow ways home', visibility: 'private' },
      ])
    );
  });

  it('deletes after asking, and leaves for the list of playlists', async () => {
    let deleted = false;
    const { user, router } = await renderPlaylist({}, [
      mockEndpoint(deletePlaylist, () => {
        deleted = true;
        return new HttpResponse<null>(null, { status: 204 });
      }),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Delete playlist' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this playlist?' });
    expect(deleted).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Delete playlist' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/feed/playlists'));
    expect(deleted).toBe(true);
  });
});
