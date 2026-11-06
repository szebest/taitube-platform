import { screen, within } from '@testing-library/react';
import type { LiveChatServerFrame, LiveStreamView } from '@vp/api-contracts';
import { apiServer, chatLine, chatRemoved } from '@vp/web-testing';
import { axeViolations, mockLiveChatSocket } from '@vp/web-testing/dom';
import { chatTicket, liveNow, liveStream } from '#app/features/live/__tests__/live-api.fixture';
import { renderLive } from '#app/features/live/__tests__/render-live';
import { LiveChatModeration } from '../live-chat-moderation';

interface ModerationOptions {
  stream?: LiveStreamView;
  lines?: LiveChatServerFrame[];
  canModerate?: boolean;
}

function renderModeration({
  stream = liveNow(),
  lines = [chatLine(1, 'Hello there'), chatLine(2, 'Nice', 'Theo')],
  canModerate = true,
}: ModerationOptions = {}) {
  const socket = mockLiveChatSocket(lines, { canModerate });
  apiServer.use(socket.handler);
  return { ...renderLive(<LiveChatModeration stream={stream} />, [chatTicket]), ...socket };
}

describe('apps/client/studio: LiveChatModeration', () => {
  it('says chat opens when the creator goes live, and opens no socket before', () => {
    const { received } = renderModeration({ stream: liveStream() });

    expect(screen.getByRole('log', { name: 'Chat' })).toHaveTextContent(
      'Chat opens when you go live.'
    );
    expect(received).toEqual([]);
  });

  it('lists the lines of a live chat, oldest first, with who wrote each', async () => {
    renderModeration();

    const log = screen.getByRole('log', { name: 'Chat' });

    expect(await within(log).findByText('Hello there')).toBeInTheDocument();
    expect(log).toHaveTextContent('Mira Hello there');
    expect(log.textContent?.indexOf('Hello there')).toBeLessThan(
      log.textContent?.indexOf('Nice') ?? 0
    );
  });

  it('removes a line through the socket when the creator presses its Remove', async () => {
    const { user, received } = renderModeration();

    await user.click(await screen.findByRole('button', { name: 'Remove message from Mira' }));

    await vi.waitFor(() => expect(received).toEqual([expect.objectContaining({ type: 'remove' })]));
  });

  it('shows a removed line as removed, without its text', async () => {
    renderModeration({ lines: [chatLine(1, 'Hello there'), chatRemoved(1)] });

    expect(await screen.findByText('Message removed')).toBeInTheDocument();
    expect(screen.queryByText('Hello there')).toBeNull();
  });

  it('gives a viewer who may not moderate no Remove', async () => {
    renderModeration({ canModerate: false });

    expect(await screen.findByText('Hello there')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove message/ })).toBeNull();
  });

  it('passes axe', async () => {
    renderModeration();
    await screen.findByText('Hello there');

    expect(await axeViolations()).toEqual([]);
  });
});
