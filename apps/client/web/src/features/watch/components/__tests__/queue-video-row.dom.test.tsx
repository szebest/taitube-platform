import { screen, within } from '@testing-library/react';
import { getRelatedVideos } from '@vp/api-contracts';
import { mockEndpoint, VIDEO_ID, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { renderWatch } from '#app/features/watch/__tests__/render-watch';

vi.mock(import('#app/features/player'), async (importOriginal) => ({
  ...(await importOriginal()),
  TaitubePlayer: (await import('#app/features/watch/__tests__/stub-player')).StubPlayer,
}));

const RELATED_ID = '0190c3a0-5e1d-7000-8000-00000000a009';

const relatedWith = (overrides = {}) =>
  mockEndpoint(getRelatedVideos, () =>
    HttpResponse.json({
      items: [
        {
          ...videoSummary({
            id: RELATED_ID,
            title: 'Tram ride',
            durationMs: 765_000,
            viewsCount: 1_200_000,
            ...overrides,
          }),
          reason: { kind: 'co-watched' as const },
        },
      ],
    })
  );

const rowOf = async (name: string) => {
  const link = await screen.findByRole('link', { name });
  const row = link.closest('[data-slot=video-card]');
  if (!(row instanceof HTMLElement)) throw new Error(`no row around ${name}`);
  return row;
};

describe('apps/client/web: queue video row', () => {
  it('shows the video as a row: its duration, its channel and views, and why it is recommended', async () => {
    await renderWatch({ handlers: [relatedWith()] });

    const row = await rowOf('Tram ride');

    expect(within(row).getByRole('link', { name: 'Tram ride' })).toHaveAttribute(
      'href',
      `/watch/${RELATED_ID}`
    );
    expect(within(row).getByText('12:45')).toBeInTheDocument();
    expect(within(row).getByText(/1\.2M views/)).toBeInTheDocument();
    expect(within(row).getByText('Viewers also watched')).toBeInTheDocument();
  });

  it('names the shared element on every row but the video on the stage', async () => {
    await renderWatch({ handlers: [relatedWith()] });

    expect(
      (await rowOf('Tram ride')).querySelector('[data-slot=video-card-thumb]')
    ).toHaveStyle({ viewTransitionName: `video-${RELATED_ID}` });
    expect(
      (await rowOf('Launch day')).querySelector('[data-slot=video-card-thumb]')
    ).not.toHaveStyle({ viewTransitionName: `video-${VIDEO_ID}` });
  });

  it('names an untitled video', async () => {
    await renderWatch({ handlers: [relatedWith({ title: null })] });

    expect(await screen.findByRole('link', { name: 'Untitled video' })).toBeInTheDocument();
  });
});
