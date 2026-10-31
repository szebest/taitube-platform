import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';

import { libraryVideo, NOW, uuid } from '#app/features/library/__tests__/library-fixtures';
import { LibraryVideoRow, type LibraryVideoRowProps } from '../library-video-row';

const render = (props: Partial<LibraryVideoRowProps> = {}) =>
  renderPage(
    <LibraryVideoRow video={libraryVideo(1, 'Tram ride')} at={NOW} actions={null} {...props} />,
    AppProviders
  );

describe('apps/client/web: LibraryVideoRow', () => {
  it.each([
    { resumeAt: 90, href: `/watch/${uuid(1)}?t=90` },
    { resumeAt: undefined, href: `/watch/${uuid(1)}` },
  ])('links the title to the watch page at $resumeAt s', async ({ resumeAt, href }) => {
    const markup = await render({ resumeAt });

    expect(markup).toMatch(
      new RegExp(`<a[^>]*href="${href.replace('?', '\\?')}"[^>]*>Tram ride</a>`)
    );
  });

  it('links the title to the playlist it is played from, at its place', async () => {
    const markup = await render({ playlist: { id: uuid(4001), index: 2 } });

    expect(markup).toContain(`href="/watch/${uuid(1)}?list=${uuid(4001)}&amp;index=2"`);
  });

  it.each([
    { progress: 0.5, bar: true },
    { progress: undefined, bar: false },
  ])('draws the resume bar only for progress $progress', async ({ progress, bar }) => {
    const markup = await render({ progress });

    expect(markup.includes('data-slot="video-thumbnail-progress"')).toBe(bar);
  });

  it('is a row card with the channel, the duration and the views', async () => {
    const markup = await render();

    expect(markup).toContain('data-variant="row"');
    expect(markup).toContain('The Creator');
    expect(markup).toContain('03:20');
    expect(markup).toContain('12 views');
  });
});
