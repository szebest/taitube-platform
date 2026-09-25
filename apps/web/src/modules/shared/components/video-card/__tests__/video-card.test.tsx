import type { UserContext } from '@vp/permissions';
import { OWNER_ID, VIDEO_ID, videoSummary } from '#app/__tests__/fixtures';
import { renderPage } from '#app/__tests__/render-page';
import { VideoCard } from '../video-card';

async function renderCard(viewer: UserContext | null, video = videoSummary()): Promise<string> {
  return renderPage(<VideoCard video={video} />, { viewer });
}

describe('apps/web: video card', () => {
  it.each<{ scenario: string; viewer: UserContext | null; visible: boolean }>([
    { scenario: 'the owner', viewer: { id: OWNER_ID, role: 'USER' }, visible: true },
    {
      scenario: 'another signed-in user',
      viewer: { id: '0190c3a0-5e1d-7000-8000-0000000000ff', role: 'USER' },
      visible: false,
    },
    { scenario: 'a guest', viewer: null, visible: false },
    {
      scenario: 'an admin',
      viewer: { id: '0190c3a0-5e1d-7000-8000-0000000000aa', role: 'ADMIN' },
      visible: true,
    },
  ])('shows the video actions to $scenario: $visible', async ({ viewer, visible }) => {
    expect((await renderCard(viewer)).includes('video actions')).toBe(visible);
  });

  it('links to the watch page and shows the title and view count', async () => {
    const markup = await renderCard(null, videoSummary({ viewsCount: 1500 }));

    expect(markup).toContain(`href="/watch/${VIDEO_ID}"`);
    expect(markup).toContain('A video');
    expect(markup).toContain('1.5K views');
  });

  it.each([
    { posterUrl: 'http://localhost:9000/posters/a.jpg', shown: true },
    { posterUrl: undefined, shown: false },
  ])(
    'renders a poster only when the API supplied one: $posterUrl',
    async ({ posterUrl, shown }) => {
      expect((await renderCard(null, videoSummary({ posterUrl }))).includes('<img')).toBe(shown);
    }
  );
});
