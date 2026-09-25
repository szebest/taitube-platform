import { renderToStaticMarkup } from 'react-dom/server';
import { VideoPlayer } from '../video-player';

describe('apps/web: video player', () => {
  it('renders nothing for a video with no playback URL yet', () => {
    expect(renderToStaticMarkup(<VideoPlayer />)).toBe('');
  });

  it('frames a full-width player for a playable video', () => {
    const markup = renderToStaticMarkup(
      <VideoPlayer playbackUrl="http://localhost:9000/hls/master.m3u8" />
    );

    expect(markup).toContain('width:100%');
    expect(markup).toContain('height:100%');
  });
});
