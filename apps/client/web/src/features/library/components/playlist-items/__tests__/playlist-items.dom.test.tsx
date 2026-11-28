import { screen, waitFor, within } from '@testing-library/react';
import { type PlaylistView, reorderPlaylist } from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { playlistDetail } from '#app/__tests__/library-fixtures';
import {
  annotatedPlaylist,
  MORNING,
  NIGHT,
} from '#app/features/library/__tests__/annotated-playlist';
import {
  ITEMS,
  LIST,
  renderPlaylist,
  renderSeries,
  rowOf,
  titles,
  VIDEOS,
} from '#app/features/library/__tests__/render-playlist';

const SMART: PlaylistView['rules'] = { match: 'all', conditions: [], sort: 'newest', limit: 50 };

const list = () => screen.getByRole('list', { name: 'Videos in Road trips' });

describe('apps/client/web: the playlist items', () => {
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

  it('shows an empty playlist as a message', async () => {
    await renderPlaylist({ items: [], videoCount: 0 });

    expect(await screen.findByText('Nothing in this playlist yet')).toBeInTheDocument();
  });

  it('numbers the episodes of a series and shows how much of each the viewer has watched', async () => {
    await renderSeries([100, 40, null], 2);

    expect(await screen.findByText('Episode 1')).toBeInTheDocument();
    expect(screen.getByText('Episode 3')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '100% watched' })).toHaveAttribute(
      'aria-valuenow',
      '100'
    );
    expect(screen.getByRole('progressbar', { name: '40% watched' })).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('numbers and measures nothing in a plain playlist', async () => {
    await renderPlaylist();

    await screen.findByText('Tram ride');

    expect(screen.queryByText(/^Episode/)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('puts the sections among the videos, each counting only the videos under it, with each note and segment', async () => {
    await renderPlaylist(annotatedPlaylist());

    expect(await rowOf('Tram ride')).toBeTruthy();
    const rows = within(list())
      .getAllByRole('listitem')
      .map((row) => row.getAttribute('aria-label'));
    expect(rows).toEqual(['Morning', 'Tram ride', 'Old film', 'Night', 'Night bus']);
    expect(within(list()).getByRole('listitem', { name: 'Morning' })).toHaveTextContent('2 videos');
    expect(within(list()).getByRole('listitem', { name: 'Night' })).toHaveTextContent('1 video');
    expect(screen.getByText('Watch with the sound off')).toBeInTheDocument();
    expect(screen.getByText('00:30 to 01:45')).toBeInTheDocument();
  });

  it('folds the videos of a section away and back', async () => {
    const { user } = await renderPlaylist(annotatedPlaylist());

    await user.click(await screen.findByRole('button', { name: 'Morning' }));

    expect(titles()).toEqual(['Night bus']);
    expect(screen.getByRole('button', { name: 'Morning' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    await user.click(screen.getByRole('button', { name: 'Morning' }));

    expect(titles()).toEqual(['Tram ride', 'Old film', 'Night bus']);
  });

  it('moves a video past the sections with the sections in the order it sends', async () => {
    const bodies: unknown[] = [];
    const { user } = await renderPlaylist(annotatedPlaylist(), [
      mockEndpoint(reorderPlaylist, async ({ request }) => {
        bodies.push(await request.clone().json());
        return HttpResponse.json(annotatedPlaylist());
      }),
    ]);

    await user.click((await rowOf('Night bus')).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to top' }));

    await waitFor(() =>
      expect(bodies).toEqual([{ itemIds: [ITEMS[2], MORNING, ITEMS[0], ITEMS[1], NIGHT] }])
    );
  });

  it('shows a smart playlist read-only: no handle, no item action and no section menu', async () => {
    const { user } = await renderPlaylist(annotatedPlaylist({ rules: SMART }));

    await user.click((await rowOf('Tram ride')).getByRole('button', { name: 'More actions' }));

    await screen.findAllByRole('menuitem');
    expect(screen.queryByRole('menuitem', { name: 'Edit note and segment' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Remove from playlist' })).toBeNull();
    expect(document.querySelector('[data-slot="sortable-list-handle"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Actions for Morning' })).toBeNull();
    expect(
      screen.getByText('This playlist fills itself from its rules, so its order cannot be changed.')
    ).toBeInTheDocument();
  });
});
