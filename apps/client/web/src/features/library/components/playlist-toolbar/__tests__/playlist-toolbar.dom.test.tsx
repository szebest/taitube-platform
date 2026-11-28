import { screen, waitFor, within } from '@testing-library/react';
import {
  listPlaylistCollaborators,
  listPlaylistItems,
  type PlaylistView,
  sortPlaylist,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { annotatedPlaylist } from '#app/features/library/__tests__/annotated-playlist';
import { renderPlaylist } from '#app/features/library/__tests__/render-playlist';
import { LazyPlaylistSectionDialog } from '#app/features/library/components/playlist-section-dialog/playlist-section-dialog.lazy';

const toolbar = async () => within(await screen.findByRole('toolbar', { name: 'Playlist tools' }));

const renderToolbar = (overrides: Partial<PlaylistView> = {}, handlers: HttpHandler[] = []) =>
  renderPlaylist(annotatedPlaylist(overrides), [
    mockEndpoint(listPlaylistItems, () =>
      HttpResponse.json({ items: annotatedPlaylist().items, nextCursor: null })
    ),
    ...handlers,
  ]);

describe('apps/client/web: the playlist toolbar', () => {
  beforeAll(() => LazyPlaylistSectionDialog.preload());

  it('puts a picked sort in the URL, writes it back for good, and returns to the manual order', async () => {
    const bodies: unknown[] = [];
    const { user, router } = await renderToolbar({}, [
      mockEndpoint(sortPlaylist, async ({ request }) => {
        bodies.push(await request.clone().json());
        return new HttpResponse<null>(null, { status: 204 });
      }),
    ]);

    await user.click((await toolbar()).getByRole('button', { name: 'Sort: Manual order' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Shortest first' }));

    await waitFor(() => expect(router.state.location.search).toMatchObject({ sort: 'duration' }));
    await user.click((await toolbar()).getByRole('button', { name: 'Save this order' }));

    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('sort'));
    expect(bodies).toEqual([{ sort: 'duration' }]);
  });

  it.each([
    {
      viewer: 'the owner',
      overrides: {},
      buttons: ['Sort: Manual order', 'Add section', 'Select', 'Import', 'Export'],
    },
    {
      viewer: 'a stranger',
      overrides: { ownerId: uuid(9001), visibility: 'public' as const },
      buttons: ['Sort: Manual order', 'Select', 'Export'],
    },
  ])('offers $viewer only the tools they may use', async ({ overrides, buttons }) => {
    await renderToolbar(overrides, [
      mockEndpoint(listPlaylistCollaborators, () => problemReply(ErrorCodes.FORBIDDEN)),
    ]);

    const shown = (await toolbar()).getAllByRole('button').map(({ textContent }) => textContent);
    expect(shown).toEqual(buttons);
  });

  it('opens the section dialog from Add section', async () => {
    const { user, router } = await renderToolbar();

    await user.click((await toolbar()).getByRole('button', { name: 'Add section' }));

    expect(await screen.findByRole('dialog', { name: 'Add a section' })).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ modal: 'playlist-section' });
  });
});
