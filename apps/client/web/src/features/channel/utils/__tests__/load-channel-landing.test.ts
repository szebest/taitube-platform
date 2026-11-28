import { getChannel, listMyMemberships } from '@vp/api-contracts';
import { createQueryClient, GUEST } from '@vp/queries';
import { account, api, apiServer, CHANNEL_ID, channel, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { channelPageApi, channelPageView } from '#app/__tests__/channel-page-fixtures';
import { pageSeedOf } from '#app/lib/query-keys/channel-page-keys';
import { loadChannelLanding } from '../load-channel-landing';

function answer(asked: string[] = []) {
  apiServer.use(
    mockEndpoint(getChannel, () => HttpResponse.json(channel())),
    mockEndpoint(listMyMemberships, () => HttpResponse.json({ items: [] })),
    ...channelPageApi(() => channelPageView(), asked)
  );
}

describe('apps/client/web: loadChannelLanding', () => {
  it('keeps the seed of the first answer and sends it with every later tab of the visit', async () => {
    const asked: string[] = [];
    answer(asked);
    const queryClient = createQueryClient();
    const context = { queryClient, api, locale: 'en', auth: GUEST };

    await loadChannelLanding(context, 'creator', undefined, {});
    await loadChannelLanding(context, 'creator', 'videos', {});

    expect(pageSeedOf(queryClient, CHANNEL_ID)).toBe('visit-1');
    expect(asked[0]).not.toContain('seed=');
    expect(asked[1]).toContain('seed=visit-1');
  });

  it.each([
    {
      scenario: 'the editor',
      auth: { status: 'signed-in', account: account() } as const,
      preview: 'subscriber',
    },
    { scenario: 'a guest', auth: GUEST, preview: null },
  ])('previews the draft for $scenario only where allowed: $preview', async ({ auth, preview }) => {
    answer();

    const loaded = await loadChannelLanding(
      { queryClient: createQueryClient(), api, locale: 'en', auth },
      'creator',
      undefined,
      { preview: 'draft', as: 'subscriber' }
    );

    expect(loaded.args.preview).toBe(preview);
    expect(loaded.previewing).toBe(preview !== null);
  });
});
