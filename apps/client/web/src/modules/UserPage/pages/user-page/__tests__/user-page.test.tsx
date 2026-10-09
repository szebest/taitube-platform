import type { QueryClient } from '@tanstack/react-query';
import { CHANNEL_ID, account, channel, feedPages, videoSummary } from '#app/__tests__/fixtures';
import { renderPage, signIn } from '#app/__tests__/render-page';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { myVideosQueryOptions } from '#app/features/videos/api/video-queries';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { UserPage } from '../user-page';

function withChannel(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setQueryData(channelQueryOptions(CHANNEL_ID).queryKey, channel());
  return queryClient;
}

async function renderChannel(queryClient: QueryClient): Promise<string> {
  return renderPage(<UserPage />, {
    queryClient,
    url: `/channel/${CHANNEL_ID}`,
    route: '/channel/$channelId',
  });
}

describe('apps/client/web: user page', () => {
  it("shows someone else's channel without their video list", async () => {
    const markup = await renderChannel(withChannel());

    expect(markup).toContain('The Creator');
    expect(markup).not.toContain('Your videos:');
  });

  it("adds the video list on the viewer's own channel", async () => {
    const queryClient = withChannel();
    signIn(account(), queryClient);
    queryClient.setQueryData(
      myVideosQueryOptions().queryKey,
      feedPages([videoSummary({ title: 'My upload' })])
    );

    const markup = await renderChannel(queryClient);

    expect(markup).toContain('Your videos:');
    expect(markup).toContain('My upload');
  });
});
