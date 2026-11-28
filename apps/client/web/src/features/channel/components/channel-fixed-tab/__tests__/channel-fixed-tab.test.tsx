import type { InfiniteData } from '@tanstack/react-query';
import { createQueryClient } from '@vp/queries';
import { api, CHANNEL_ID, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders, withToasts } from '#app/__tests__/providers';
import {
  channelPlaylistsQueryOptions,
  channelVideosQueryOptions,
} from '#app/lib/query-keys/channel-page-keys';
import { ChannelFixedTab } from '../channel-fixed-tab';

const videos = (
  titles: string[]
): InfiniteData<
  { items: ReturnType<typeof videoSummary>[]; nextCursor: null },
  string | undefined
> => ({
  pages: [{ items: titles.map((title) => videoSummary({ title })), nextCursor: null }],
  pageParams: [undefined],
});

describe('apps/client/web: ChannelFixedTab', () => {
  it.each([
    { kind: 'videos' as const, format: 'standard' as const },
    { kind: 'shorts' as const, format: 'short' as const },
  ])('lists the channel $kind from the $format feed', async ({ kind, format }) => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(
      channelVideosQueryOptions(api, CHANNEL_ID, format).queryKey,
      videos(['The pilot'])
    );

    const markup = await renderPage(
      <ChannelFixedTab kind={kind} channelId={CHANNEL_ID} />,
      withToasts(AppProviders),
      { queryClient }
    );

    expect(markup).toContain('The pilot');
  });

  it('lists the playlists with their video counts, and says so when there are none', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(channelPlaylistsQueryOptions(api, CHANNEL_ID).queryKey, {
      items: [
        {
          id: '0190a1b2-0000-7000-8000-0000000000c1',
          title: 'Season one',
          description: '',
          thumbnailUrl: null,
          thumbnailUrls: [],
          videoCount: 4,
          updatedAt: '2026-11-01T10:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    const empty = createQueryClient();
    empty.setQueryData(channelPlaylistsQueryOptions(api, CHANNEL_ID).queryKey, {
      items: [],
      nextCursor: null,
    });

    const filled = await renderPage(
      <ChannelFixedTab kind="playlists" channelId={CHANNEL_ID} />,
      withToasts(AppProviders),
      { queryClient }
    );
    const none = await renderPage(
      <ChannelFixedTab kind="playlists" channelId={CHANNEL_ID} />,
      withToasts(AppProviders),
      { queryClient: empty }
    );

    expect(filled).toContain('Season one');
    expect(filled).toContain('4 videos');
    expect(none).toContain('Nothing here yet');
  });
});
