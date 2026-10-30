import { createQueryClient } from '@vp/queries';
import { api, VIDEO_ID, video } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { myReactionQueryOptions } from '#app/features/reactions/api/reaction-queries';
import { VideoLikes } from '../video-likes';

type Shown = {
  video?: Parameters<typeof video>[0];
  Providers?: typeof AppProviders;
  queryClient?: ReturnType<typeof createQueryClient>;
};

const renderLikes = ({ video: overrides, Providers = AppProviders, queryClient }: Shown = {}) =>
  renderPage(<VideoLikes video={video(overrides)} />, Providers, { queryClient });

describe('apps/client/web: video likes', () => {
  it('shows the like and dislike counts, rounded', async () => {
    const markup = await renderLikes({ video: { likesCount: 1250, dislikesCount: 12_500 } });

    expect(markup).toContain('1.3K');
    expect(markup).toContain('13K');
  });

  it('marks neither button for a guest', async () => {
    const markup = await renderLikes();

    expect(markup).not.toContain('-fill');
  });

  it.each([
    { reaction: 'LIKE', filled: 'bi-hand-thumbs-up-fill', unfilled: 'bi-hand-thumbs-down"' },
    { reaction: 'DISLIKE', filled: 'bi-hand-thumbs-down-fill', unfilled: 'bi-hand-thumbs-up"' },
  ] as const)(
    'marks the $reaction the signed-in viewer gave',
    async ({ reaction, filled, unfilled }) => {
      const queryClient = createQueryClient();
      queryClient.setQueryData(myReactionQueryOptions(api, VIDEO_ID).queryKey, {
        videoId: VIDEO_ID,
        reaction,
      });

      const markup = await renderLikes({ Providers: signedIn(), queryClient });

      expect(markup).toContain(filled);
      expect(markup).toContain(unfilled);
    }
  );
});
