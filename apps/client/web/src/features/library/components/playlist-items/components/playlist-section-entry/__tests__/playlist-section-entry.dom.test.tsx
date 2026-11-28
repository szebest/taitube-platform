import { screen, waitFor, within } from '@testing-library/react';
import { removePlaylistSection } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { annotatedPlaylist, NIGHT } from '#app/features/library/__tests__/annotated-playlist';
import { renderPlaylist } from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: a section of the playlist', () => {
  it('removes the section and keeps the videos under it', async () => {
    const removed: string[] = [];
    const { user } = await renderPlaylist(annotatedPlaylist(), [
      mockEndpoint(removePlaylistSection, ({ params }) => {
        removed.push(String(params.itemId));
        return new HttpResponse<null>(null, { status: 204 });
      }),
    ]);

    await user.click(await screen.findByRole('button', { name: 'Actions for Night' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove section' }));

    const list = screen.getByRole('list', { name: 'Videos in Road trips' });
    await waitFor(() => expect(within(list).queryByRole('listitem', { name: 'Night' })).toBeNull());
    expect(within(list).getByRole('listitem', { name: 'Night bus' })).toBeInTheDocument();
    expect(removed).toEqual([NIGHT]);
    expect(await screen.findByText('Section removed')).toBeInTheDocument();
  });
});
