import { screen, within } from '@testing-library/react';
import { account, chatLine } from '@vp/web-testing';

import { renderLive } from '#app/features/live/__tests__/render-live';

vi.mock(import('#app/features/player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/features/live/__tests__/stub-live-player')).StubLivePlayer,
}));

async function renderChat(options: Parameters<typeof renderLive>[0] = {}) {
  const rendered = await renderLive({ lines: [chatLine(1, 'Hello there')], ...options });
  const chat = within(screen.getByRole('region', { name: 'Live chat' }));
  await chat.findByText('Hello there');
  return { ...rendered, chat };
}

describe('apps/client/web: LiveStreamChat', () => {
  it('shows a guest the lines and the way to sign in, with no composer', async () => {
    const { chat } = await renderChat();

    expect(chat.getByText('Mira')).toBeInTheDocument();
    expect(chat.getByRole('link', { name: 'Sign in to chat' })).toHaveAttribute(
      'href',
      expect.stringContaining('/login?redirect=')
    );
    expect(chat.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('sends what a signed-in viewer writes, showing it as theirs while it is on its way', async () => {
    const { chat, socket, user } = await renderChat({ viewer: account() });

    await user.type(await chat.findByRole('textbox', { name: 'Say something' }), 'Hi all{Enter}');

    expect(chat.getByText('Hi all')).toBeInTheDocument();
    expect(chat.getByText('You')).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(socket.received).toEqual([
        expect.objectContaining({ type: 'send', message: 'Hi all' }),
      ])
    );
  });

  it('pins the line saying only subscribers can chat once the creator switches it on', async () => {
    const { chat } = await renderChat({
      lines: [
        chatLine(1, 'Hello there'),
        { type: 'mode', mode: { slowModeSeconds: 0, subscribersOnly: true } },
      ],
    });

    expect(await chat.findByText('Only subscribers can chat right now')).toBeInTheDocument();
  });

  it('tells a signed-in viewer the socket will not take their lines, with no sign-in link', async () => {
    const { chat } = await renderChat({ viewer: account(), canSend: false });

    expect(await chat.findByText('You cannot chat right now.')).toBeInTheDocument();
    expect(chat.getByRole('textbox', { name: 'Say something' })).toBeDisabled();
    expect(chat.queryByRole('link', { name: 'Sign in to chat' })).not.toBeInTheDocument();
  });
});
