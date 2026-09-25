import { createApiStore, seed } from '#app/__tests__/api-store';
import { VIDEO_ID, account, video } from '#app/__tests__/fixtures';
import { renderPage, signIn } from '#app/__tests__/render-page';
import { reactionsApi } from '#app/modules/shared/api/reactions-api';
import { VideoLikes } from '../video-likes';

describe('apps/web: video likes', () => {
  it('shows the like and dislike counts, rounded', async () => {
    const markup = await renderPage(
      <VideoLikes video={video({ likesCount: 1250, dislikesCount: 12_500 })} />
    );

    expect(markup).toContain('1.3K');
    expect(markup).toContain('13K');
  });

  it('marks neither button for a guest', async () => {
    const markup = await renderPage(<VideoLikes video={video()} />);

    expect(markup).not.toContain('-fill');
  });

  it.each([
    { reaction: 'LIKE', filled: 'bi-hand-thumbs-up-fill', unfilled: 'bi-hand-thumbs-down"' },
    { reaction: 'DISLIKE', filled: 'bi-hand-thumbs-down-fill', unfilled: 'bi-hand-thumbs-up"' },
  ])('marks the $reaction the signed-in viewer gave', async ({ reaction, filled, unfilled }) => {
    const store = createApiStore();
    await signIn(store, account());
    await seed(
      store,
      (target) => target.dispatch(reactionsApi.endpoints.myReaction.initiate(VIDEO_ID)),
      { videoId: VIDEO_ID, reaction }
    );

    const markup = await renderPage(<VideoLikes video={video()} />, { store });

    expect(markup).toContain(filled);
    expect(markup).toContain(unfilled);
  });
});
