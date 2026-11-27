import { communityFeedQueryOptions, createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { post } from '#app/__tests__/post-fixtures';
import { AppProvidersWithToasts } from '#app/__tests__/providers';
import { SubscriptionCommunity } from '../subscription-community';

function renderCommunity(posts: ReturnType<typeof post>[]) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(communityFeedQueryOptions(api, null).queryKey, {
    pages: [{ items: posts, nextCursor: null }],
    pageParams: [undefined],
  });

  return renderPage(<SubscriptionCommunity />, AppProvidersWithToasts, { queryClient });
}

describe('apps/client/web: subscription community', () => {
  it('titles the page and lists the posts', async () => {
    const markup = await renderCommunity([post()]);

    expect(markup).toContain('>Community posts</h1>');
    expect(markup).toContain('A new episode is out');
  });

  it('says so when no subscribed channel has posted', async () => {
    expect(await renderCommunity([])).toContain(
      'Posts from the channels you subscribe to show up here'
    );
  });
});
