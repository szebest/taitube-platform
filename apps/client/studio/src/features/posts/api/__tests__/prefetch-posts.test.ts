import { QueryClient } from '@tanstack/react-query';
import { listManagedPosts } from '@vp/api-contracts';
import { createActingChannelStore, GUEST } from '@vp/queries';
import { account, api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { postKeys } from '../post-queries';
import { prefetchPosts } from '../prefetch-posts';

const TEAM = '0190c3a0-5e1d-7000-8000-0000000fe010';

function prefetch(auth: Parameters<typeof prefetchPosts>[0]['auth'], selected?: string) {
  const queryClient = new QueryClient();
  const actingChannel = createActingChannelStore();
  actingChannel.select(selected);
  onTestFinished(() => actingChannel.select(undefined));
  const asked: unknown[] = [];
  apiServer.use(
    mockEndpoint(listManagedPosts, () => {
      asked.push(true);
      return HttpResponse.json({ items: [], nextCursor: null });
    })
  );
  return {
    queryClient,
    asked,
    run: () => prefetchPosts({ api, queryClient, auth, actingChannel }, 'draft'),
  };
}

describe('apps/client/studio: prefetchPosts', () => {
  it('fills the list of the channel the viewer acts on', async () => {
    const signedIn = { status: 'signed-in', account: account() } as const;
    const { queryClient, run } = prefetch(signedIn, TEAM);

    await run();

    expect(queryClient.getQueryData(postKeys.list(TEAM, 'draft'))).toBeDefined();
  });

  it('falls back to the viewer own channel', async () => {
    const creator = account();
    const { queryClient, run } = prefetch({ status: 'signed-in', account: creator });

    await run();

    expect(queryClient.getQueryData(postKeys.list(creator.channel.id, 'draft'))).toBeDefined();
  });

  it('asks nothing of a guest', async () => {
    const { asked, run } = prefetch(GUEST);

    await run();

    expect(asked).toEqual([]);
  });
});
