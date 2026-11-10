import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { type CreatorInboxCommentView, listCreatorComments } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { apiServer, inboxComment, mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { AppProviders } from '#app/__tests__/providers';
import { QueueDetail } from '../queue-detail';

const COMMENT = inboxComment({
  id: '0190c3a0-5e1d-7000-8000-00000000d001',
  content: 'Buy followers',
  status: 'held',
  moderation: { state: 'held', heldReason: 'blocked_word' },
});

const renderDetail = (comment = COMMENT) =>
  render(
    <QueryClientProvider client={createQueryClient()}>
      <QueueDetail comment={comment} />
    </QueryClientProvider>,
    { wrapper: AppProviders }
  );

const serveHistory = (items: CreatorInboxCommentView[]) =>
  apiServer.use(
    mockEndpoint(listCreatorComments, () => HttpResponse.json({ items, nextCursor: null }))
  );

const failHistory = () =>
  apiServer.use(mockEndpoint(listCreatorComments, () => problemReply(ErrorCodes.FORBIDDEN)));

describe('apps/client/studio: QueueDetail', () => {
  it('names why the comment was held, where it is and what it says', async () => {
    serveHistory([]);
    renderDetail(inboxComment({ ...COMMENT, parentId: '0190c3a0-5e1d-7000-8000-00000000d0aa' }));

    expect(screen.getByText('Matched a blocked word')).toBeInTheDocument();
    expect(screen.getByText('Buy followers')).toBeInTheDocument();
    expect(screen.getByText(/A reply in a thread/)).toBeInTheDocument();
    expect(await screen.findByText('No other comments on your channel.')).toBeInTheDocument();
  });

  it('lists the other comments of the author with their state, not the open one', async () => {
    serveHistory([
      COMMENT,
      inboxComment({ id: '0190c3a0-5e1d-7000-8000-00000000d002', content: 'Earlier one' }),
    ]);
    renderDetail();

    expect(await screen.findByText('Earlier one')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getAllByText('Buy followers')).toHaveLength(1);
  });

  it('says when the history did not load', async () => {
    failHistory();
    renderDetail();

    expect(await screen.findByText('Their other comments did not load.')).toBeInTheDocument();
  });
});
