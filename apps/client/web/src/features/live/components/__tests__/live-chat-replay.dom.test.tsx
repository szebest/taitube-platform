import { screen, within } from '@testing-library/react';

import { renderLive } from '#app/features/live/__tests__/render-live';

vi.mock(import('#app/features/player/taitube-player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/live/__tests__/stub-live-player')).StubLivePlayer,
}));

describe('apps/client/web: LiveChatReplay', () => {
  it('says no one had written yet when nothing was posted before the playhead', async () => {
    await renderLive({ stream: { status: 'ENDED', playbackUrl: 'http://localhost:9000/a.m3u8' } });

    const chat = within(screen.getByRole('region', { name: 'Live chat' }));

    expect(chat.getByRole('heading', { name: 'Chat replay' })).toBeInTheDocument();
    expect(
      await chat.findByText('No one had written in the chat by this point.')
    ).toBeInTheDocument();
    expect(chat.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
