import { screen } from '@testing-library/react';
import { getPlaylist } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail, uuid } from '#app/__tests__/library-fixtures';
import { LIST, renderPlaylist, VIDEOS } from '#app/features/library/__tests__/render-playlist';

const SOURCE = uuid(4400);

const renderFork = (source: () => Response) =>
  renderPlaylist({ forkedFromPlaylistId: SOURCE }, [
    mockEndpoint(getPlaylist, ({ params }) =>
      params.id === SOURCE
        ? source()
        : HttpResponse.json(playlistDetail(LIST, VIDEOS, { forkedFromPlaylistId: SOURCE }))
    ),
  ]);

describe('apps/client/web: the fork attribution', () => {
  it('credits the source by its title, linked', async () => {
    await renderFork(() =>
      HttpResponse.json(playlistDetail(SOURCE, [], { title: 'Lisbon trams' }))
    );

    expect(await screen.findByRole('link', { name: 'Lisbon trams' })).toHaveAttribute(
      'href',
      `/playlist?list=${SOURCE}`
    );
    expect(screen.getByText('Forked from')).toBeInTheDocument();
  });

  it('says the source is gone once it answers not found', async () => {
    await renderFork(() => problemReply(ErrorCodes.PLAYLIST_NOT_FOUND));

    expect(
      await screen.findByText('Forked from a playlist that is no longer available')
    ).toBeInTheDocument();
  });
});
