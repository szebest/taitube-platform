import { renderToStaticMarkup } from 'react-dom/server';
import { VideoPlayer } from '../video-player';

function renderVideoPlayer(playbackUrl?: string): string {
  return renderToStaticMarkup(<VideoPlayer playbackUrl={playbackUrl} />);
}

describe('apps/client/web: video player', () => {
  it('renders nothing for a video with no playback URL yet', () => {
    expect(renderVideoPlayer()).toBe('');
  });

  it('frames a full-width player for a playable video', () => {
    const markup = renderVideoPlayer('http://localhost:9000/hls/master.m3u8');

    expect(markup).toContain('width:100%');
    expect(markup).toContain('height:100%');
  });
});
