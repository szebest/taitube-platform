import { screen, waitFor } from '@testing-library/react';
import { updatePlaylist } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { playlistDetail } from '#app/features/library/__tests__/library-fixtures';
import { renderPlaylist, VIDEOS } from '#app/features/library/__tests__/render-playlist';

describe('apps/client/web: the playlist details form', () => {
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

  it('leaves the details as they were on cancel', async () => {
    const { user } = await renderPlaylist();

    await user.click(await screen.findByRole('button', { name: 'Edit details' }));
    await user.clear(screen.getByRole('textbox', { name: 'Title' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Road trips' })
    ).toBeInTheDocument();
  });
});
