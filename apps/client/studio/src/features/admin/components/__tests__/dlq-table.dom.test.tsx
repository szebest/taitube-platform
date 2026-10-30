import { screen, within } from '@testing-library/react';
import { listDlq } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw';

import { dlqEntry, renderQueues } from './queues.fixture';

const PARKED = dlqEntry({ jobId: 'job-parked' });
const REPLAYED = dlqEntry({ jobId: 'job-replayed', status: 'REPLAYED' });

const rowOf = (job: string) => screen.getByText(job).closest('tr') as HTMLElement;

describe('apps/client/studio: DlqTable', () => {
  it('lists the entries with their queue, error and status', async () => {
    await renderQueues('/admin/queues', [PARKED, REPLAYED]);

    expect(await screen.findByText('job-parked')).toBeInTheDocument();
    expect(within(rowOf('job-parked')).getByText('transcode')).toBeInTheDocument();
    expect(within(rowOf('job-parked')).getByText('FFMPEG_FAILED')).toBeInTheDocument();
    expect(within(rowOf('job-parked')).getByText('Parked')).toBeInTheDocument();
    expect(within(rowOf('job-replayed')).getByText('Replayed')).toBeInTheDocument();
  });

  it('offers replay and discard on parked entries only', async () => {
    await renderQueues('/admin/queues', [PARKED, REPLAYED]);
    await screen.findByText('job-parked');

    expect(within(rowOf('job-parked')).getAllByRole('button')).toHaveLength(2);
    expect(within(rowOf('job-replayed')).queryByRole('button')).not.toBeInTheDocument();
  });

  it('filters by status through the URL', async () => {
    const { user, requests, router } = await renderQueues('/admin/queues', [PARKED, REPLAYED]);
    await screen.findByText('job-parked');

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Replayed' }));

    await vi.waitFor(() => expect(screen.queryByText('job-parked')).not.toBeInTheDocument());
    expect(screen.getByText('job-replayed')).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ status: 'REPLAYED' });
    expect(requests.queries.some((query) => query.get('status') === 'REPLAYED')).toBe(true);
  });

  it('reads the status filter from the URL', async () => {
    await renderQueues('/admin/queues?status=REPLAYED', [PARKED, REPLAYED]);

    expect(await screen.findByText('job-replayed')).toBeInTheDocument();
    expect(screen.queryByText('job-parked')).not.toBeInTheDocument();
  });

  it('loads the next page on request', async () => {
    const second = dlqEntry({ jobId: 'job-second' });
    const { user } = await renderQueues('/admin/queues', [], {
      handlers: [
        mockEndpoint(listDlq, ({ request }) => {
          const { searchParams } = new URL(request.url);
          const paged = !searchParams.get('status');
          return searchParams.get('cursor')
            ? HttpResponse.json({ items: [second], nextCursor: null })
            : HttpResponse.json({ items: [PARKED], nextCursor: paged ? 'next' : null });
        }),
      ],
    });
    await screen.findByText('job-parked');

    await user.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('job-second')).toBeInTheDocument();
  });

  it('shows Nothing failed with no action when the queue is empty', async () => {
    await renderQueues('/admin/queues', []);

    expect(await screen.findByText('Nothing failed')).toBeInTheDocument();
    expect(screen.getByText('Jobs that run out of retries are parked here.')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Dead-letter jobs' })).queryByRole('button')
    ).not.toBeInTheDocument();
  });

  it('shows a section error with a retry while the rest of the page stays, and recovers on it', async () => {
    let failing = true;
    const { user } = await renderQueues('/admin/queues', [], {
      handlers: [
        mockEndpoint(listDlq, ({ request }) =>
          failing && !new URL(request.url).searchParams.get('status')
            ? problemReply(ErrorCodes.INTERNAL)
            : HttpResponse.json({ items: [PARKED], nextCursor: null })
        ),
      ],
    });

    expect(await screen.findByText('The dead-letter queue did not load.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Bull Board' })).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('job-parked')).toBeInTheDocument();
  });

  it('links Bull Board', async () => {
    await renderQueues('/admin/queues', []);

    expect(await screen.findByRole('link', { name: 'Open Bull Board' })).toHaveAttribute(
      'href',
      'http://localhost:3000/admin/queues'
    );
  });
});
