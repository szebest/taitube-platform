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

const related = (...ids: string[]) =>
  mockEndpoint(getRelatedVideos, () =>
    HttpResponse.json({
      items: ids.map((id) => ({
        ...videoSummary({ id, title: id === VIDEO_ID ? 'Launch day' : 'Tram ride' }),
        reason: { kind: 'co-watched' as const },
      })),
    })
  );

function matchMedia(matching: string[]) {
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: matching.includes(media),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('apps/client/web: watch queue', () => {
  it('holds the video on the stage alone, marked as playing, with its place in the queue', async () => {
    await renderWatch();

    const queue = screen.getByRole('region', { name: 'Your queue' });
    const items = within(within(queue).getByRole('list', { name: 'Your queue' })).getAllByRole('listitem');

    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAttribute('aria-current', 'true');
    expect(within(queue).getByText('Now playing')).toBeInTheDocument();
    expect(within(queue).getByText('1 / 1')).toBeInTheDocument();
  });

  it('lists the related videos under "More like this", leaving the video on the stage out', async () => {
    await renderWatch({ handlers: [related(VIDEO_ID, RELATED_ID)] });

    const more = await screen.findByRole('region', { name: 'More like this' });

    expect(within(more).getAllByRole('link')).toHaveLength(1);
    expect(within(more).getByRole('link', { name: 'Tram ride' })).toBeInTheDocument();
  });

  it.each([
    { scenario: 'no related video', handler: related() },
    { scenario: 'only the video on the stage', handler: related(VIDEO_ID) },
  ])('has no "More like this" for $scenario', async ({ handler }) => {
    await renderWatch({ handlers: [handler] });

    expect(screen.queryByRole('region', { name: 'More like this' })).not.toBeInTheDocument();
  });

  it('shows an empty queue with a way back to browsing once the video is removed', async () => {
    const { user } = await renderWatch();

    await user.click(screen.getByRole('button', { name: 'Remove Launch day from the queue' }));

    expect(screen.getByText('Nothing queued')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse' })).toHaveAttribute('href', '/');
  });

  it('opens a recommended video in the watch page', async () => {
    const { user } = await renderWatch({ handlers: [related(RELATED_ID)] });

    await user.click(await screen.findByRole('link', { name: 'Tram ride' }));

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('moves under the stage and beside the discussion in theater mode', async () => {
    const { user } = await renderWatch();
    const queue = () => screen.getByRole('region', { name: 'Your queue' });
    expect(queue()).not.toHaveAttribute('data-layout');

    await user.click(screen.getByRole('button', { name: 'Theater mode' }));

    expect(queue()).toHaveAttribute('data-layout', 'below');
  });

  it('opens in a drawer behind a Queue button on a compact screen', async () => {
    matchMedia(['(max-width: 599px)']);
    const { user } = await renderWatch();
    expect(screen.queryByRole('region', { name: 'Your queue' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Queue' }));

    expect(
      within(await screen.findByRole('dialog')).getByRole('region', { name: 'Your queue' })
    ).toBeInTheDocument();
  });
});
