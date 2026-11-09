import { screen, within } from '@testing-library/react';
import { chatMessage } from '@vp/web-testing';
import { renderLive } from '#app/features/live/__tests__/render-live';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/features/live/__tests__/stub-live-player')).StubLivePlayer,
}));

const ENDED = { status: 'ENDED' as const, playbackUrl: 'http://localhost:9000/archive.m3u8' };

describe('apps/client/web: useChatReplay', () => {
  it('asks for the window the playhead is in, the one before and the one ahead', async () => {
    const { replayWindows } = await renderLive({ stream: ENDED });

    await vi.waitFor(
      () =>
        expect(replayWindows).toEqual(
          expect.arrayContaining(['30000-60000', '60000-90000', '90000-120000'])
        ),
      { timeout: 25_000 }
    );
  });

  it('shows the lines posted up to the playhead, in the order they were posted', async () => {
    await renderLive({
      stream: ENDED,
      replay: [chatMessage(40, 'Before'), chatMessage(74, 'Just now'), chatMessage(76, 'Ahead')],
    });

    const chat = within(screen.getByRole('region', { name: 'Live chat' }));

    await vi.waitFor(() =>
      expect(chat.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        expect.stringContaining('Before'),
        expect.stringContaining('Just now'),
      ])
    );
  });
});
