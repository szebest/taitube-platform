import { screen, waitFor, within } from '@testing-library/react';
import { updatePlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { playlistDetail } from '#app/__tests__/library-fixtures';
import { collaborator, seated } from '#app/features/library/__tests__/playlist-people';
import {
  chooseFromMore,
  LAZY,
  LIST,
  renderPlaylist,
  VIDEOS,
} from '#app/features/library/__tests__/render-playlist';
import { LazySettingsDialog } from '#app/features/library/components/settings-dialog/settings-dialog.lazy';

/** The owner's playlist with its Settings dialog open; `bodies` collects each update sent. */
async function openSettings(overrides: object = {}, handlers: HttpHandler[] = []) {
  const bodies: unknown[] = [];
  const rendered = await renderPlaylist(overrides, [
    ...handlers,
    mockEndpoint(updatePlaylist, async ({ request }) => {
      const body = await request.json();
      bodies.push(body);
      return HttpResponse.json(playlistDetail(LIST, VIDEOS, body as object));
    }),
  ]);
  await chooseFromMore(rendered.user, 'Settings');
  const dialog = within(await screen.findByRole('dialog', { name: 'Playlist settings' }, LAZY));
  return { ...rendered, dialog, bodies };
}

beforeAll(() => LazySettingsDialog.preload());

describe('apps/client/web: the playlist settings dialog', () => {
  it('turns on removing watched videos', async () => {
    const { user, dialog, bodies } = await openSettings();

    await user.click(dialog.getByRole('switch', { name: 'Remove videos once watched' }));

    await waitFor(() => expect(bodies).toEqual([{ autoRemoveWatched: true }]));
    expect(await screen.findByText('Settings saved')).toBeInTheDocument();
  });

  it.each([
    {
      reason: 'others work on it',
      overrides: {},
      handlers: [seated([collaborator(1, 'Ana')])],
      says: 'Not available while others work on this playlist',
    },
    {
      reason: 'it is smart',
      overrides: {
        rules: { match: 'all' as const, conditions: [], sort: 'newest' as const, limit: 50 },
      },
      handlers: [],
      says: 'A smart playlist picks its videos, so nothing is removed',
    },
  ])('holds the switch off when $reason', async ({ overrides, handlers, says }) => {
    const { dialog } = await openSettings(overrides, handlers);

    expect(await dialog.findByText(says)).toBeInTheDocument();
    expect(dialog.getByRole('switch', { name: 'Remove videos once watched' })).toBeDisabled();
  });

  it('shows a refusal beside the settings', async () => {
    const { user, dialog } = await openSettings({}, [
      mockEndpoint(updatePlaylist, () => problemReply(ErrorCodes.PLAYLIST_HAS_COLLABORATORS)),
    ]);

    await user.click(dialog.getByRole('switch', { name: 'Remove videos once watched' }));

    expect(await dialog.findByRole('alert')).toBeInTheDocument();
  });

  it('covers the playlist with one of its videos', async () => {
    const { user, dialog, bodies } = await openSettings();

    await user.click(dialog.getByRole('combobox', { name: 'Cover' }));
    expect(screen.queryByRole('option', { name: 'Custom image' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'One of its videos' }));

    await waitFor(() =>
      expect(bodies).toEqual([{ coverMode: 'item', coverVideoId: VIDEOS[0]?.id }])
    );
  });
});
