import { screen, waitFor, within } from '@testing-library/react';
import { editPlaylistItem } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { annotatedPlaylist } from '#app/features/library/__tests__/annotated-playlist';
import { ITEMS, renderPlaylist, rowOf } from '#app/features/library/__tests__/render-playlist';
import { LazyPlaylistItemDialog } from '../playlist-item-dialog.lazy';

/** The annotated playlist with the item dialog of `title` open, its edits recorded. */
const renderItemDialog = async (title = 'Night bus') => {
  const bodies: unknown[] = [];
  const rendered = await renderPlaylist(annotatedPlaylist(), [
    mockEndpoint(editPlaylistItem, async ({ request }) => {
      bodies.push(await request.clone().json());
      return new HttpResponse<null>(null, { status: 204 });
    }),
  ]);
  await rendered.user.click((await rowOf(title)).getByRole('button', { name: 'More actions' }));
  await rendered.user.click(await screen.findByRole('menuitem', { name: 'Edit note and segment' }));
  const dialog = within(await screen.findByRole('dialog', { name: 'Note and segment' }));
  return { ...rendered, dialog, bodies };
};

describe('apps/client/web: the item dialog', () => {
  beforeAll(() => LazyPlaylistItemDialog.preload());

  it('saves a note and a segment typed as times, and closes', async () => {
    const { user, dialog, bodies, router } = await renderItemDialog();

    expect(router.state.location.search).toMatchObject({
      modal: 'playlist-item',
      itemId: ITEMS[2],
    });
    await user.click(dialog.getByRole('textbox', { name: 'Note' }));
    await user.paste('The bridge at dusk');
    expect(dialog.getByText('18 of 300')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Play only part of it' }));
    const start = dialog.getByRole('textbox', { name: 'Start' });
    await user.clear(start);
    await user.type(start, '0:30');
    const end = dialog.getByRole('textbox', { name: 'End' });
    await user.clear(end);
    await user.type(end, '1:45');
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(bodies).toEqual([{ note: 'The bridge at dusk', startMs: 30_000, endMs: 105_000 }])
    );
    expect(await screen.findByText('Note and segment saved')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it.each([
    { case: 'under a second', start: '0:30', end: '0:30', message: /at least a second/ },
    { case: 'past the end of the video', start: '0:30', end: '9:00', message: /inside the video/ },
    { case: 'not a time', start: 'soon', end: '1:00', message: 'Write a time as m:ss' },
  ])('refuses a segment $case before sending it', async ({ start, end, message }) => {
    const { user, dialog, bodies } = await renderItemDialog();

    await user.click(dialog.getByRole('button', { name: 'Play only part of it' }));
    await user.clear(dialog.getByRole('textbox', { name: 'Start' }));
    await user.type(dialog.getByRole('textbox', { name: 'Start' }), start);
    await user.clear(dialog.getByRole('textbox', { name: 'End' }));
    await user.type(dialog.getByRole('textbox', { name: 'End' }), end);

    expect(await dialog.findByText(message)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(bodies).toEqual([]);
  });

  it('clears the segment an item had', async () => {
    const { user, dialog, bodies } = await renderItemDialog('Old film');

    await user.click(dialog.getByRole('button', { name: 'Clear segment' }));
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(bodies).toEqual([{ note: null, startMs: null, endMs: null }]));
  });
});
