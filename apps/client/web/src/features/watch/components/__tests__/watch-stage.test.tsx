import { VIDEO_ID, video } from '@vp/web-testing';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppProviders } from '#app/__tests__/providers';
import { WatchStage } from '../watch-stage';

const POSTER = 'http://localhost:9000/posters/p.jpg';

const PLAYABLE = video({
  title: 'Launch day',
  posterUrl: POSTER,
  playbackUrl: 'http://localhost:9000/hls/master.m3u8',
});

const renderOnServer = (overrides: Parameters<typeof video>[0] = {}) =>
  renderToStaticMarkup(
    <AppProviders>
      <WatchStage video={{ ...PLAYABLE, id: VIDEO_ID, ...overrides }} startTime={90} />
    </AppProviders>
  );

const STAGE =
  /<section data-slot="stage"[^>]*aria-label="Video player"[^>]*class="[^"]*tw:aspect-video/;

describe('apps/client/web: watch stage', () => {
  it.each([
    { scenario: 'a playable video', overrides: {} },
    { scenario: 'a video with no playback URL yet', overrides: { playbackUrl: undefined } },
  ])('server-renders the poster on a 16:9 stage and no player for $scenario', ({ overrides }) => {
    const markup = renderOnServer(overrides);

    expect(markup).toMatch(STAGE);
    expect(markup).toMatch(
      new RegExp(`<img data-slot="stage-poster"[^>]*src="${POSTER}" alt="Launch day"`)
    );
    expect(markup).not.toContain('<video');
  });

  it('keeps the 16:9 stage empty for a video with no poster', () => {
    const markup = renderOnServer({ posterUrl: undefined });

    expect(markup).toMatch(STAGE);
    expect(markup).not.toContain('<img');
  });
});
