import { screen } from '@testing-library/react';
import { listDlq } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw';

import { dlqEntry, renderQueues } from './queues.fixture';

describe('apps/client/studio: DlqParkedCount', () => {
  it('counts the parked entries and ignores the others', async () => {
    await renderQueues('/admin/queues', [
      dlqEntry(),
      dlqEntry(),
      dlqEntry({ status: 'REPLAYED' }),
    ]);

    const stat = (await screen.findByText('Parked jobs')).parentElement as HTMLElement;

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(stat).toHaveTextContent('2');
  });

  it('adds a plus when the first page is not all of them', async () => {
    await renderQueues('/admin/queues', [], {
      handlers: [
        mockEndpoint(listDlq, ({ request }) =>
          HttpResponse.json({
            items: [dlqEntry()],
            nextCursor: new URL(request.url).searchParams.get('status') ? 'more' : null,
          })
        ),
      ],
    });

    expect(await screen.findByText('1+')).toBeInTheDocument();
  });

  it('fails on its own with a retry, leaving the list to answer for itself', async () => {
    const entry = dlqEntry();
    await renderQueues('/admin/queues', [entry], {
      handlers: [
        mockEndpoint(listDlq, ({ request }) =>
          new URL(request.url).searchParams.get('status') === 'PARKED'
            ? problemReply(ErrorCodes.INTERNAL)
            : HttpResponse.json({ items: [entry], nextCursor: null })
        ),
      ],
    });

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(await screen.findByText(entry.jobId)).toBeInTheDocument();
  });
});
