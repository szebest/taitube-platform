import { renderToStaticMarkup } from 'react-dom/server';
import { WatchPlayer } from '../watch-player';

const PLAYBACK = 'http://localhost:9000/hls/master.m3u8';

describe('apps/web: watch player', () => {
  it.each([
    {
      scenario: 'the poster',
      posterUrl: 'http://localhost:9000/posters/p.jpg',
      expected: '<img src="http://localhost:9000/posters/p.jpg" alt=""',
    },
    { scenario: 'an empty frame without a poster', posterUrl: undefined, expected: '<div style=' },
  ])('server-renders $scenario in place of the player', ({ posterUrl, expected }) => {
    const markup = renderToStaticMarkup(
      <WatchPlayer playbackUrl={PLAYBACK} posterUrl={posterUrl} />
    );

    expect(markup).toContain(expected);
    expect(markup).not.toContain('<video');
  });
});
