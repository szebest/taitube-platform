import { videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import type { ReactElement } from 'react';

import { AppProviders } from '#app/__tests__/providers';
import { VideoGrid, VideoGridSkeleton } from '../video-grid';

const renderGrid = (grid: ReactElement) => renderPage(grid, AppProviders);

const manyVideos = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    videoSummary({
      id: `0190c3a0-5e1d-7000-8000-${String(index).padStart(12, '0')}`,
      title: `Video ${index}`,
    })
  );

const listClass = (markup: string) => markup.match(/<ul[^>]*class="([^"]+)"/)?.[1];

describe('apps/client/web: video grid', () => {
  it('lays one card per video out in a list', async () => {
    const markup = await renderGrid(
      <VideoGrid
        videos={[
          videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000a011', title: 'First' }),
          videoSummary({ id: '0190c3a0-5e1d-7000-8000-00000000a012', title: 'Second' }),
        ]}
      />
    );

    expect(markup.match(/<li/g)).toHaveLength(2);
    expect(markup).toContain('>First</a>');
    expect(markup).toContain('>Second</a>');
  });

  it('stands its skeleton in on the same grid, hidden from assistive technology', async () => {
    const loaded = await renderGrid(<VideoGrid videos={[videoSummary()]} />);
    const skeleton = await renderGrid(<VideoGridSkeleton />);

    expect(listClass(skeleton)).toBe(listClass(loaded));
    expect(skeleton).toMatch(/^<ul aria-hidden="true"/);
    expect(skeleton.match(/<li/g)).toHaveLength(12);
  });

  it('renders the first screen of a long list, not all of it, and pads for the rest', async () => {
    const markup = await renderGrid(<VideoGrid videos={manyVideos(2000)} />);

    expect(markup.match(/<li/g)?.length).toBeLessThan(50);
    expect(markup).toContain('>Video 0</a>');
    expect(markup).not.toContain('>Video 1999</a>');
    expect(
      Number.parseFloat(markup.match(/padding-bottom:([\d.]+)px/)?.[1] ?? '0')
    ).toBeGreaterThan(10_000);
  });
});
