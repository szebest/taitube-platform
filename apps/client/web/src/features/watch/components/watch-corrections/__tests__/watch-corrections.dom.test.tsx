import { screen, within } from '@testing-library/react';
import { listVideoCorrections } from '@vp/api-contracts';
import { VIDEO_ID, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { renderWatch } from '#app/__tests__/render-watch';
import { stubSeek } from '#app/__tests__/stub-player';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const serve = (items: { id: string; startMs: number; endMs: number; text: string }[]) =>
  mockEndpoint(listVideoCorrections, () =>
    HttpResponse.json({
      items: items.map((item) => ({
        ...item,
        videoId: VIDEO_ID,
        createdAt: '2026-03-01T12:00:00.000Z',
      })),
    })
  );

describe('apps/client/web: WatchCorrections', () => {
  it('lists the corrections under the description and seeks to the one clicked', async () => {
    const { user } = await renderWatch({
      handlers: [
        serve([
          {
            id: '0190c3a0-5e1d-7000-8000-00000000d001',
            startMs: 83_000,
            endMs: 88_000,
            text: 'It costs 5 dollars',
          },
          {
            id: '0190c3a0-5e1d-7000-8000-00000000d002',
            startMs: 200_000,
            endMs: 205_000,
            text: 'The year is 2026',
          },
        ]),
      ],
    });

    const section = await screen.findByRole('region', { name: 'Corrections' });
    await user.click(within(section).getByRole('button', { name: 'Go to 01:23' }));

    expect(within(section).getByText('It costs 5 dollars')).toBeInTheDocument();
    expect(within(section).getByText('The year is 2026')).toBeInTheDocument();
    expect(stubSeek).toHaveBeenLastCalledWith(83);
  });

  it('shows no section for a video without corrections', async () => {
    await renderWatch({ handlers: [serve([])] });

    expect(screen.queryByRole('region', { name: 'Corrections' })).toBeNull();
  });
});
