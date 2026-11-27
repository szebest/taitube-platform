import { screen, waitFor, within } from '@testing-library/react';
import { listPlaylistActivity, restorePlaylistActivity } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { uuid } from '#app/__tests__/library-fixtures';
import { activity, seated, seatedAs } from '#app/features/library/__tests__/playlist-people';
import {
  chooseFromMore,
  LAZY,
  ITEMS,
  renderPlaylist,
  VIDEOS,
} from '#app/features/library/__tests__/render-playlist';
import { LazyActivityDrawer } from '#app/features/library/components/activity-drawer/activity-drawer.lazy';

const REMOVED = activity(1, 'item_removed', {
  itemId: uuid(5999),
  videoId: uuid(99),
  title: null,
  addedBy: null,
  note: null,
  startMs: null,
  endMs: null,
});
const ADDED = activity(2, 'item_added', { itemId: ITEMS[0] ?? '', videoId: VIDEOS[0]?.id ?? '' });

/** The playlist's Activity drawer open over `REMOVED` and `ADDED`; `restores` collects each restore asked for. */
async function openActivity(
  overrides: object = {},
  restoreReply: () => Response = () => new HttpResponse(null, { status: 204 })
) {
  const restores: string[] = [];
  const rendered = await renderPlaylist(overrides, [
    seated([], 'editor'),
    mockEndpoint(listPlaylistActivity, () =>
      HttpResponse.json({ items: [REMOVED, ADDED], nextCursor: null })
    ),
    mockEndpoint(restorePlaylistActivity, ({ params }) => {
      restores.push(String(params.activityId));
      return restoreReply();
    }),
  ]);
  await chooseFromMore(rendered.user, 'Activity');
  const drawer = within(await screen.findByRole('dialog', { name: 'Activity' }, LAZY));
  return { ...rendered, drawer, restores };
}

beforeAll(() => LazyActivityDrawer.preload());

describe('apps/client/web: the activity drawer', () => {
  it('says each change in a sentence, newest first', async () => {
    const { drawer } = await openActivity();

    const list = await drawer.findByRole('list', { name: 'Changes to this playlist' });

    expect(
      within(list)
        .getAllByRole('listitem')
        .map((row) => row.querySelector('p')?.textContent)
    ).toEqual(['Ana removed a video', 'Ana added Tram ride']);
  });

  it('restores a removed item for the owner', async () => {
    const { user, drawer, restores } = await openActivity();

    await user.click(await drawer.findByRole('button', { name: 'Restore: Ana removed a video' }));

    await waitFor(() => expect(restores).toEqual([REMOVED.id]));
    expect(await screen.findByText('Put it back at the end of the playlist')).toBeInTheDocument();
  });

  it('says why a restore was refused', async () => {
    const { user, drawer } = await openActivity({}, () =>
      problemReply(ErrorCodes.PLAYLIST_ACTIVITY_NOT_RESTORABLE)
    );

    await user.click(await drawer.findByRole('button', { name: 'Restore: Ana removed a video' }));

    expect(await screen.findByText('That change could not be saved')).toBeInTheDocument();
  });

  it('offers no Restore to a collaborator', async () => {
    const { drawer } = await openActivity(seatedAs('editor'));

    await drawer.findByRole('list', { name: 'Changes to this playlist' });

    expect(drawer.queryByRole('button', { name: /^Restore/ })).not.toBeInTheDocument();
  });
});
