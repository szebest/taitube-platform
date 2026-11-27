import { renderPage } from '@vp/web-testing/server';
import { SHARE_PLAYLIST_ID, SHARE_VIDEO_ID } from '#app/__tests__/post-fixtures';
import { AppProviders } from '#app/__tests__/providers';
import { PostCard, type PostShare } from '..';

const VIDEO: PostShare = {
  type: 'video',
  id: SHARE_VIDEO_ID,
  title: 'Lisbon at night',
  thumbnailUrl: 'https://cdn.test/thumb.jpg',
  durationSeconds: 125,
};

const render = (share: PostShare, startMs?: number | null) =>
  renderPage(<PostCard.ShareCard share={share} startMs={startMs} />, AppProviders);

describe('apps/client/web: PostCard share card', () => {
  it.each([
    { startMs: null, href: `/watch/${SHARE_VIDEO_ID}` },
    { startMs: 0, href: `/watch/${SHARE_VIDEO_ID}` },
    { startMs: 90_500, href: `/watch/${SHARE_VIDEO_ID}?t=90` },
  ])('opens a shared video at $href when it starts at $startMs', async ({ startMs, href }) => {
    const markup = await render(VIDEO, startMs);

    expect(markup).toContain(`href="${href}"`);
    expect(markup).toContain('Lisbon at night');
    expect(markup).toContain('2:05');
  });

  it('says where in the video a quoted moment opens', async () => {
    expect(await render(VIDEO, 90_000)).toContain('Opens at 01:30');
  });

  it('links a shared playlist with its video count', async () => {
    const markup = await render({
      type: 'playlist',
      id: SHARE_PLAYLIST_ID,
      title: 'Night trams',
      itemCount: 4,
    });

    expect(markup).toContain(`href="/playlist?list=${SHARE_PLAYLIST_ID}"`);
    expect(markup).toContain('4 videos');
  });

  it('shows Unavailable and no link once the target is gone', async () => {
    const markup = await render({ type: 'unavailable' });

    expect(markup).toContain('Unavailable');
    expect(markup).not.toContain('<a ');
  });
});
