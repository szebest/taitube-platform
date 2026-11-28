import { getChannelPage, previewChannelPage } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, CHANNEL_ID, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { channelPageView } from '#app/__tests__/channel-page-fixtures';
import {
  type ChannelPageArgs,
  channelPageQueryOptions,
  pageSeedOf,
  rememberPageSeed,
} from '../channel-page-keys';

const ARGS: ChannelPageArgs = {
  channelId: CHANNEL_ID,
  slug: undefined,
  locale: 'en',
  viewerId: null,
  preview: null,
};

describe('apps/client/web: channel page queries', () => {
  it.each([
    { scenario: 'tab', other: { slug: 'shows' } },
    { scenario: 'viewer', other: { viewerId: 'u1' } },
    { scenario: 'preview audience', other: { preview: 'subscriber' } },
    { scenario: 'locale', other: { locale: 'pl' } },
  ] as const)('never shares a cache entry between two $scenario', ({ other }) => {
    expect(channelPageQueryOptions(api, { ...ARGS, ...other }).queryKey).not.toEqual(
      channelPageQueryOptions(api, ARGS).queryKey
    );
  });

  it('asks the public endpoint with the seed, and the preview endpoint only for a preview', async () => {
    const asked: string[] = [];
    apiServer.use(
      mockEndpoint(getChannelPage, ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json(channelPageView());
      }),
      mockEndpoint(previewChannelPage, ({ request }) => {
        asked.push(new URL(request.url).search);
        return HttpResponse.json(channelPageView());
      })
    );
    const queryClient = createQueryClient();

    await queryClient.query(channelPageQueryOptions(api, { ...ARGS, slug: 'shows' }, 'visit-1'));
    await queryClient.query(channelPageQueryOptions(api, { ...ARGS, preview: 'subscriber' }));

    expect(asked).toEqual(['?tab=shows&locale=en&seed=visit-1', '?as=subscriber&locale=en']);
  });

  it('remembers the seed per channel', () => {
    const queryClient = createQueryClient();
    rememberPageSeed(queryClient, CHANNEL_ID, 'visit-1');

    expect(pageSeedOf(queryClient, CHANNEL_ID)).toBe('visit-1');
    expect(pageSeedOf(queryClient, 'other')).toBeUndefined();
  });
});
