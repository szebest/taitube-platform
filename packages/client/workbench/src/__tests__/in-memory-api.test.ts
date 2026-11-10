import { ApiError } from '@vp/api-client';
import { isSubscribedToChannel, subscribeToChannel } from '@vp/api-contracts';
import { inMemoryApi } from '../in-memory-api';

const CHANNEL_ID = '0190c3a0-5e1d-7000-8000-00000000c001';

describe('@vp/workbench: inMemoryApi', () => {
  it('answers a contract from its reply, with the path params the call carried', async () => {
    const api = inMemoryApi([
      {
        contract: isSubscribedToChannel,
        body: ({ params }) => ({ channelId: params.id, subscribed: true }),
      },
    ]);

    await expect(
      api.subscriptions.isSubscribedToChannel({ params: { id: CHANNEL_ID } })
    ).resolves.toEqual({ channelId: CHANNEL_ID, subscribed: true });
  });

  it('keeps what a reply closes over between calls', async () => {
    let subscribed = false;
    const api = inMemoryApi([
      { contract: isSubscribedToChannel, body: () => ({ channelId: CHANNEL_ID, subscribed }) },
      {
        contract: subscribeToChannel,
        body: () => {
          subscribed = true;
          return { channelId: CHANNEL_ID, subscribed, subscriberCount: 1 };
        },
      },
    ]);

    await api.subscriptions.subscribeToChannel({ params: { id: CHANNEL_ID } });

    await expect(
      api.subscriptions.isSubscribedToChannel({ params: { id: CHANNEL_ID } })
    ).resolves.toMatchObject({ subscribed: true });
  });

  it('answers a path no reply names with a 404, so a story never reaches a network', async () => {
    const api = inMemoryApi([]);

    await expect(
      api.subscriptions.isSubscribedToChannel({ params: { id: CHANNEL_ID } })
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      api.subscriptions.isSubscribedToChannel({ params: { id: CHANNEL_ID } })
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('answers a method no reply names with a 404 on a path another method holds', async () => {
    const api = inMemoryApi([
      { contract: subscribeToChannel, body: () => ({ channelId: CHANNEL_ID }) },
    ]);

    await expect(
      api.subscriptions.unsubscribeFromChannel({ params: { id: CHANNEL_ID } })
    ).rejects.toMatchObject({ status: 404 });
  });
});
