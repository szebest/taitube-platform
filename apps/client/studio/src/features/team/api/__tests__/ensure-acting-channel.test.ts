import {
  type ActingChannelStore,
  createQueryClient,
  GUEST,
  membershipsQueryOptions,
  type Session,
} from '@vp/queries';
import { account, api, apiServer } from '@vp/web-testing';
import {
  membership,
  OTHER_CHANNEL_ID,
  serveTeam,
} from '#app/features/team/__tests__/team-api.fixture';
import { ensureActingChannel, forgetChannelData } from '../ensure-acting-channel';
import { teamKeys } from '../team-queries';

const SIGNED_IN: Session = { status: 'signed-in', account: account() };

function storeActingOn(channelId: string | undefined) {
  let selected = channelId;
  const store: ActingChannelStore = {
    read: () => selected,
    select: (next) => {
      selected = next;
    },
    subscribe: () => () => undefined,
  };
  return store;
}

async function ensure(
  session: Session,
  channelId: string | undefined,
  held = [membership('editor')]
) {
  const served = serveTeam({ memberships: held });
  apiServer.use(...served.handlers);
  const queryClient = createQueryClient();
  queryClient.setQueryData(['videos', 'mine'], ['cached for the channel being left']);
  const actingChannel = storeActingOn(channelId);

  await ensureActingChannel({ auth: session, api, queryClient, actingChannel });

  return { queryClient, actingChannel };
}

describe('apps/client/studio: ensureActingChannel', () => {
  it('loads the channels the viewer works on, for a viewer acting on their own', async () => {
    const { queryClient } = await ensure(SIGNED_IN, undefined);

    expect(queryClient.getQueryData(membershipsQueryOptions(api).queryKey)).toEqual({
      items: [membership('editor')],
    });
  });

  it('asks nothing of a guest', async () => {
    const { queryClient } = await ensure(GUEST, OTHER_CHANNEL_ID);

    expect(queryClient.getQueryData(teamKeys.memberships())).toBeUndefined();
  });

  it('keeps the channel the viewer still works on, and what the cache holds for it', async () => {
    const { queryClient, actingChannel } = await ensure(SIGNED_IN, OTHER_CHANNEL_ID);

    expect(actingChannel.read()).toBe(OTHER_CHANNEL_ID);
    expect(queryClient.getQueryData(['videos', 'mine'])).toBeDefined();
  });

  it('puts a viewer whose membership ended back on their own channel and drops what the cache held for the other', async () => {
    const { queryClient, actingChannel } = await ensure(SIGNED_IN, OTHER_CHANNEL_ID, []);

    expect(actingChannel.read()).toBeUndefined();
    expect(queryClient.getQueryData(['videos', 'mine'])).toBeUndefined();
    expect(queryClient.getQueryData(teamKeys.memberships())).toEqual({ items: [] });
  });
});

describe('apps/client/studio: forgetChannelData', () => {
  it('keeps the session and the viewer’s channels, and nothing else', () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['session'], 'viewer');
    queryClient.setQueryData(teamKeys.memberships(), { items: [] });
    queryClient.setQueryData(teamKeys.members(), { members: [], invites: [] });
    queryClient.setQueryData(['videos', 'mine'], []);

    forgetChannelData(queryClient);

    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .map(({ queryKey }) => queryKey)
    ).toEqual([['session'], teamKeys.memberships()]);
  });
});
