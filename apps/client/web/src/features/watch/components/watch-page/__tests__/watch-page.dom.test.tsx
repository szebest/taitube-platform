import { screen, within } from '@testing-library/react';
import { getLiveChatReplay } from '@vp/api-contracts';
import { chatMessage, LIVE_STREAM_ID, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderWatch } from '#app/__tests__/render-watch';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

describe('apps/client/web: watch page', () => {
  it.each([
    { scenario: 'a titled video', title: 'Launch day', heading: 'Launch day' },
    { scenario: 'an untitled video', title: null, heading: 'Untitled video' },
  ])('heads the page of $scenario with its title', async ({ title, heading }) => {
    await renderWatch({ video: { title } });

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('puts the engagement bar, the notes and the related videos on the page', async () => {
    await renderWatch();

    expect(screen.getByRole('toolbar', { name: 'Video actions' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Description' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'More like this' })).toBeInTheDocument();
  });

  it('shows the chat replay of a recording up to the playhead', async () => {
    const replay = [
      chatMessage(40, 'Before'),
      chatMessage(74, 'Just now'),
      chatMessage(76, 'Ahead'),
    ];
    await renderWatch({
      video: { liveStreamId: LIVE_STREAM_ID },
      handlers: [
        mockEndpoint(getLiveChatReplay, ({ request }) => {
          const { searchParams } = new URL(request.url);
          const fromMs = Number(searchParams.get('fromMs'));
          const toMs = Number(searchParams.get('toMs'));
          const items = replay.filter(({ offsetMs }) => offsetMs >= fromMs && offsetMs < toMs);
          return HttpResponse.json({ items });
        }),
      ],
    });

    const chat = within(await screen.findByRole('region', { name: 'Live chat' }));

    await vi.waitFor(() =>
      expect(chat.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
        expect.stringContaining('Before'),
        expect.stringContaining('Just now'),
      ])
    );
  });

  it('has no chat slot for a video that records no broadcast', async () => {
    await renderWatch({ video: { liveStreamId: null } });

    expect(screen.queryByRole('region', { name: 'Live chat' })).not.toBeInTheDocument();
  });
});
