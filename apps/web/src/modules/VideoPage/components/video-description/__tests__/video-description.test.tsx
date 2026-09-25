import { renderToStaticMarkup } from 'react-dom/server';
import { video } from '../../../../../__tests__/fixtures';
import { VideoDescription } from '../video-description';

const NOW = new Date('2026-03-10T12:00:00.000Z');

describe('apps/web: video description', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('says how long ago the video was published', () => {
    const anHourAgo = new Date(NOW.getTime() - 60 * 60_000).toISOString();

    const markup = renderToStaticMarkup(<VideoDescription video={video({ createdAt: anHourAgo })} />);

    expect(markup).toContain('1 hour ago');
  });

  it('shows a short description whole', () => {
    const markup = renderToStaticMarkup(<VideoDescription video={video({ description: 'Short and sweet' })} />);

    expect(markup).toContain('Short and sweet');
  });

  it('cuts a long description at 255 characters until the viewer asks for more', () => {
    const description = `${'a'.repeat(255)}THE REST`;

    const markup = renderToStaticMarkup(<VideoDescription video={video({ description })} />);

    expect(markup).toContain('a'.repeat(255));
    expect(markup).not.toContain('THE REST');
    expect(markup).toContain('Show more');
  });
});
