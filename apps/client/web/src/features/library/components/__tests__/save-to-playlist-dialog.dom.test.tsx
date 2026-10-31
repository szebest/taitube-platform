import { screen, within } from '@testing-library/react';
import {
  addPlaylistItem,
  createPlaylist,
  listMyPlaylists,
  type PlaylistView,
  removePlaylistItem,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { heldReply, renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import {
  historyItem,
  ownedPlaylist,
  playlistDetail,
  uuid,
  WATCH_LATER_ID,
} from '#app/features/library/__tests__/library-fixtures';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { getRouter } from '#app/router';

const VIDEO_ID = uuid(7);
const URL = `/feed/history?modal=save-to-playlist&videoId=${VIDEO_ID}`;
const TRIPS = uuid(4001);

/** Playlists that answer "does it hold the video" from what the writes since put in them. */
function playlistsHolding(
  held: Set<string>,
  writes: string[],
  extra: HttpHandler[] = []
): HttpHandler[] {
  const playlists = [
    ownedPlaylist(0, { id: WATCH_LATER_ID, title: 'Watch later', isSystem: true }),
    ownedPlaylist(1, { title: 'Road trips' }),
  ];

  return [
    ...extra,
    mockEndpoint(listMyPlaylists, () =>
      HttpResponse.json({
        items: [
          ...playlists.map((playlist) => ({ ...playlist, containsVideo: held.has(playlist.id) })),
          ...[...held]
            .filter((id) => !playlists.some((playlist) => playlist.id === id))
            .map((id) => ownedPlaylist(9, { id, title: 'Trips', containsVideo: true })),
        ],
      })
    ),
    mockEndpoint(addPlaylistItem, ({ params }) => {
      writes.push(`add ${params.id}`);
      held.add(String(params.id));
      return HttpResponse.json(playlistDetail(String(params.id), []), { status: 201 });
    }),
    mockEndpoint(removePlaylistItem, ({ params }) => {
      writes.push(`remove ${params.id} ${params.videoId}`);
      held.delete(String(params.id));
      return new HttpResponse<null>(null, { status: 204 });
    }),
  ];
}

async function openDialog(held: Set<string>, extra: HttpHandler[] = []) {
  const writes: string[] = [];
  const rendered = await renderLibrary(URL, { handlers: playlistsHolding(held, writes, extra) });
  const dialog = await screen.findByRole('dialog', { name: 'Save to playlist' });
  return { ...rendered, writes, dialog };
}

describe('apps/client/web: SaveToPlaylistDialog', () => {
  it('opens from a direct link with Watch later first and the right boxes checked', async () => {
    const { dialog } = await openDialog(new Set([TRIPS]));

    const boxes = await within(dialog).findAllByRole('checkbox');

    expect(boxes.map((box) => box.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(within(dialog).getByRole('checkbox', { name: 'Watch later' })).toBe(boxes[0]);
    expect(within(dialog).getByRole('checkbox', { name: 'Road trips' })).toBe(boxes[1]);
  });

  it('checks a box before the server answers, and says it is saved once it has', async () => {
    const held = heldReply<HttpResponse<PlaylistView>>(() =>
      HttpResponse.json(playlistDetail(TRIPS, []), { status: 201 })
    );
    const { user, dialog } = await openDialog(new Set(), [
      mockEndpoint(addPlaylistItem, held.answer),
    ]);

    await user.click(await within(dialog).findByRole('checkbox', { name: 'Road trips' }));

    expect(within(dialog).getByRole('checkbox', { name: 'Road trips' })).toBeChecked();
    held.release();
    expect(await screen.findByText('Saved to Road trips')).toBeInTheDocument();
  });

  it('takes the video out of a playlist that holds it', async () => {
    const { user, dialog, writes } = await openDialog(new Set([TRIPS]));

    await user.click(await within(dialog).findByRole('checkbox', { name: 'Road trips' }));

    expect(await screen.findByText('Removed from Road trips')).toBeInTheDocument();
    expect(writes).toEqual([`remove ${TRIPS} ${VIDEO_ID}`]);
  });

  it('unchecks the box and says so when the server refuses', async () => {
    const { user, dialog } = await openDialog(new Set(), [
      mockEndpoint(addPlaylistItem, () => problemReply(ErrorCodes.INTERNAL)),
    ]);

    await user.click(await within(dialog).findByRole('checkbox', { name: 'Road trips' }));

    expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Road trips' })).not.toBeChecked();
  });

  it('creates a playlist that holds the video, from the dialog', async () => {
    const bodies: unknown[] = [];
    const held = new Set<string>();
    const { user, dialog, writes } = await openDialog(held, [
      mockEndpoint(createPlaylist, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json(playlistDetail(uuid(4900), [], { title: 'Trips' }), {
          status: 201,
        });
      }),
    ]);

    await user.click(await within(dialog).findByRole('button', { name: 'New playlist' }));
    expect(within(dialog).getByRole('button', { name: 'Create' })).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Trips');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Saved to Trips')).toBeInTheDocument();
    expect(bodies).toEqual([{ title: 'Trips', visibility: 'private' }]);
    expect(writes).toEqual([`add ${uuid(4900)}`]);
    expect(await within(dialog).findByRole('checkbox', { name: 'Trips' })).toBeChecked();
  });

  it('opens from the Save action of a card, for the video on that card', async () => {
    const { user, router } = await renderLibrary('/feed/history', {
      history: [historyItem(7, { title: 'Tram ride' })],
      handlers: playlistsHolding(new Set(), []),
    });

    const card = (await screen.findByRole('link', { name: 'Tram ride' })).closest('article');
    if (!card) throw new Error('no card around Tram ride');
    await user.click(within(card as HTMLElement).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Save' }));

    expect(await screen.findByRole('dialog', { name: 'Save to playlist' })).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({
      modal: 'save-to-playlist',
      videoId: VIDEO_ID,
    });
  });

  it('asks a guest to sign in instead of listing playlists', async () => {
    await renderRoute(getRouter, URL, { handlers: loaderApi() });

    const dialog = await screen.findByRole('dialog', { name: 'Save to playlist' });

    expect(within(dialog).getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).toBeNull();
  });
});
