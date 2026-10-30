import { screen, within } from '@testing-library/react';
import { listAdminVideos } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw';

import { adminVideo, renderModeration } from './moderation.fixture';

const CATS = adminVideo({ title: 'Cats', viewsCount: 5 });
const DOGS = adminVideo({ title: 'Dogs', viewsCount: 9, visibility: 'private' });
const BIRDS = adminVideo({ title: 'Birds', status: 'REJECTED' });

const shownTitles = () =>
  within(screen.getByRole('table', { name: 'Every video' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);

const lastQuery = (queries: URLSearchParams[]) => Object.fromEntries(queries.at(-1) ?? []);

describe('apps/client/studio: ModerationTable', () => {
  it('lists every video the API returns, with its status and visibility', async () => {
    await renderModeration('/admin/moderation', { videos: [[CATS, DOGS, BIRDS]] });

    expect(await screen.findByText('Dogs')).toBeInTheDocument();
    expect(shownTitles()).toEqual(['Cats', 'Dogs', 'Birds']);
    expect(within(screen.getByText('Dogs').closest('tr') as HTMLElement).getByText('Private')).toBeInTheDocument();
  });

  it('asks for the newest first by default, and for the sort a header click picks', async () => {
    const { user, requests } = await renderModeration('/admin/moderation', { videos: [[CATS, DOGS]] });
    await screen.findByText('Cats');
    expect(lastQuery(requests.videoQueries)).toMatchObject({ limit: '30' });

    await user.click(screen.getByRole('button', { name: /Views/ }));

    await screen.findByText('Dogs');
    expect(lastQuery(requests.videoQueries)).toMatchObject({ sort: 'views', order: 'desc' });
  });

  it('reads sort and filters from the URL', async () => {
    const { requests } = await renderModeration(
      '/admin/moderation?sort=title&order=asc&status=READY&visibility=public',
      { videos: [[CATS]] }
    );
    await screen.findByText('Cats');

    expect(lastQuery(requests.videoQueries)).toMatchObject({
      sort: 'title',
      order: 'asc',
      status: 'READY',
      visibility: 'public',
    });
  });

  it('loads the next page on request and appends it', async () => {
    const { user } = await renderModeration('/admin/moderation', { videos: [[CATS], [DOGS]] });
    await screen.findByText('Cats');

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Dogs')).toBeInTheDocument();
    expect(shownTitles()).toEqual(['Cats', 'Dogs']);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it.each([
    { scenario: 'rejected', video: BIRDS, offered: ['Force private', 'Delete'] },
    { scenario: 'private', video: DOGS, offered: ['Reject', 'Delete'] },
    { scenario: 'public and ready', video: CATS, offered: ['Force private', 'Reject', 'Delete'] },
  ])('offers $offered on a $scenario video', async ({ video, offered }) => {
    const { user } = await renderModeration('/admin/moderation', { videos: [[video]] });

    await user.click(await screen.findByRole('button', { name: `Actions for ${video.title}` }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(offered);
  });

  it('shows one empty state, with a clear action only while filtering', async () => {
    const { user } = await renderModeration('/admin/moderation?status=FAILED', { videos: [[]] });

    expect(await screen.findByText('No videos to show')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('No videos to show')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('shows a section error with a retry when the load fails, and recovers on it', async () => {
    let failing = true;
    const { user } = await renderModeration('/admin/moderation', {
      handlers: [
        mockEndpoint(listAdminVideos, () =>
          failing
            ? problemReply(ErrorCodes.INTERNAL)
            : HttpResponse.json({ items: [CATS], nextCursor: null })
        ),
      ],
    });

    expect(await screen.findByText('The videos did not load.')).toBeInTheDocument();
    failing = false;
    await user.click(screen.getAllByRole('button', { name: 'Try again' })[0] as HTMLElement);

    expect(await screen.findByText('Cats')).toBeInTheDocument();
  });
});
