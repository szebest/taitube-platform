import { screen } from '@testing-library/react';
import { apiServer, chatLine, chatRemoved, LIVE_STREAM_ID } from '@vp/web-testing';
import { mockLiveChatSocket } from '@vp/web-testing/dom';

import { chatTicket } from '#app/features/live/__tests__/live-api.fixture';
import { renderLive } from '#app/features/live/__tests__/render-live';
import { OverlayChat } from '../overlay-chat';

function renderChat(lines: Parameters<typeof mockLiveChatSocket>[0]) {
  apiServer.use(mockLiveChatSocket(lines).handler);
  return renderLive(<OverlayChat liveStreamId={LIVE_STREAM_ID} />, [chatTicket]);
}

describe('apps/client/studio: OverlayChat', () => {
  it('shows each line as a card with its author', async () => {
    renderChat([chatLine(1, 'Hello there')]);

    const card = (await screen.findByText('Hello there')).closest('article');

    expect(card).toHaveTextContent('MiraHello there');
  });

  it('keeps the latest fifteen lines', async () => {
    renderChat(Array.from({ length: 20 }, (_, index) => chatLine(index + 1, `line ${index + 1}`)));

    expect(await screen.findByText('line 20')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(15);
    expect(screen.queryByText('line 5')).toBeNull();
    expect(screen.getByText('line 6')).toBeInTheDocument();
  });

  it('drops a line a moderator removed', async () => {
    renderChat([chatLine(1, 'Spam'), chatLine(2, 'Kept'), chatRemoved(1)]);

    expect(await screen.findByText('Kept')).toBeInTheDocument();
    expect(screen.queryByText('Spam')).toBeNull();
  });
});
