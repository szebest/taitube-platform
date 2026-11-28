import { screen, waitFor, within } from '@testing-library/react';
import { createPlaylist, search } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { person } from '#app/features/library/__tests__/playlist-people';
import { renderLibrary } from '#app/features/library/__tests__/render-library';
import { LAZY } from '#app/features/library/__tests__/render-playlist';

const CHANNEL_A = { ...person(1, 'Alfama'), bio: '', subscriberCount: 0 };
const CHANNEL_B = { ...person(2, 'Belem'), bio: '', subscriberCount: 0 };

/** The New playlist dialog switched to a smart playlist; `bodies` collects what Create sends. */
async function openSmartPlaylist() {
  const bodies: unknown[] = [];
  const rendered = await renderLibrary('/feed/history?modal=new-playlist', {
    handlers: [
      mockEndpoint(createPlaylist, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(playlistDetail(uuid(4900), [], { title: 'Short trips' }), {
          status: 201,
        });
      }),
      mockEndpoint(search, () =>
        HttpResponse.json({
          items: [
            { type: 'channel', data: CHANNEL_A },
            { type: 'channel', data: CHANNEL_B },
          ],
          nextCursor: null,
          tookMs: 1,
          total: 2,
          fuzzyFallback: false,
        })
      ),
    ],
  });
  const dialog = within(await screen.findByRole('dialog', { name: 'New playlist' }, LAZY));
  await rendered.user.click(dialog.getByRole('radio', { name: 'Smart playlist' }));
  return { ...rendered, dialog, bodies };
}

describe('apps/client/web: the smart rules editor', () => {
  it('builds "channel A or B, under 10 minutes, unwatched, newer than 30 days" and sends it', async () => {
    const { user, dialog, bodies } = await openSmartPlaylist();
    const pickField = async (position: number, field: string) => {
      await user.click(dialog.getByRole('button', { name: 'Add condition' }));
      await user.click(dialog.getByRole('combobox', { name: `Field of condition ${position}` }));
      await user.click(await screen.findByRole('option', { name: field }));
    };

    await user.type(dialog.getByRole('textbox', { name: 'Title' }), 'Short trips');
    await user.click(dialog.getByRole('button', { name: 'Add condition' }));
    for (const name of ['Alfama', 'Belem']) {
      await user.type(dialog.getByRole('combobox', { name: 'Channels, up to 20' }), 'a');
      await user.click(await screen.findByRole('option', { name: new RegExp(name) }, LAZY));
    }
    await pickField(2, 'Duration');
    await pickField(3, 'Unwatched');
    await pickField(4, 'Newer than');
    await user.click(dialog.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(bodies).toEqual([
        {
          title: 'Short trips',
          visibility: 'private',
          rules: {
            match: 'all',
            conditions: [
              { field: 'channel', channelIds: [CHANNEL_A.id, CHANNEL_B.id] },
              { field: 'duration', duration: { op: 'under', seconds: 600 } },
              { field: 'unwatched' },
              { field: 'newer_than', days: 30 },
            ],
            sort: 'newest',
            limit: 50,
          },
        },
      ])
    );
  });

  it('holds Create back while a condition is not finished', async () => {
    const { user, dialog } = await openSmartPlaylist();

    await user.type(dialog.getByRole('textbox', { name: 'Title' }), 'Short trips');
    await user.click(dialog.getByRole('button', { name: 'Add condition' }));

    await waitFor(() => expect(dialog.getByRole('button', { name: 'Create' })).toBeDisabled());
    await user.click(dialog.getByRole('button', { name: 'Remove condition 1' }));
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Create' })).toBeEnabled());
  });
});
