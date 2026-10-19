import { renderToStaticMarkup } from 'react-dom/server';
import { WatchPlayer, type WatchPlayerProps } from '../watch-player';

const POSTER = 'http://localhost:9000/posters/p.jpg';

const renderOnServer = (props: Partial<WatchPlayerProps> = {}) =>
  renderToStaticMarkup(
    <WatchPlayer
      playbackUrl="http://localhost:9000/hls/master.m3u8"
      posterUrl={POSTER}
      title="Launch day"
      {...props}
    />
  );

describe('apps/client/web: watch player', () => {
  it.each([
    { scenario: 'a playable video', props: {} },
    { scenario: 'a video with no playback URL yet', props: { playbackUrl: undefined } },
  ])('server-renders the poster in a 16:9 frame and no player for $scenario', ({ props }) => {
    const markup = renderOnServer(props);

    expect(markup).toMatch(
      new RegExp(`<div class="[^"]*tw:aspect-video[^"]*"><img src="${POSTER}" alt=""`)
    );
    expect(markup).not.toContain('<video');
  });

  it('keeps the 16:9 frame empty for a video with no poster', () => {
    expect(renderOnServer({ posterUrl: undefined })).toMatch(
      /<div class="[^"]*tw:aspect-video[^"]*"><\/div>$/
    );
  });
});
