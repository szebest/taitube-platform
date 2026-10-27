import { renderToStaticMarkup } from 'react-dom/server';

import { AppProviders } from '#app/__tests__/providers';
import { WatchPlayer, type WatchPlayerProps } from '../watch-player';

const POSTER = 'http://localhost:9000/posters/p.jpg';

const renderOnServer = (props: Partial<WatchPlayerProps> = {}) =>
  renderToStaticMarkup(
    <AppProviders>
      <WatchPlayer
        id="0f8fad5b-d9cb-469f-a165-70867728950e"
        playbackUrl="http://localhost:9000/hls/master.m3u8"
        posterUrl={POSTER}
        title="Launch day"
        {...props}
      />
    </AppProviders>
  );

const STAGE =
  /<section data-slot="stage"[^>]*aria-label="Video player"[^>]*class="[^"]*tw:aspect-video/;

describe('apps/client/web: watch player', () => {
  it.each([
    { scenario: 'a playable video', props: {} },
    { scenario: 'a video with no playback URL yet', props: { playbackUrl: undefined } },
  ])('server-renders the poster on a 16:9 stage and no player for $scenario', ({ props }) => {
    const markup = renderOnServer(props);

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
