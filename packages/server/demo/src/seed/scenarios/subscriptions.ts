import { isErr } from '@vp/result';
import { AnySchema, SubscriptionStateSchema } from '../responses';
import { type Scenario, actorOf, userById } from '../scenario';
import { createTally } from '../tally';

export const subscriptions: Scenario = {
  name: 'subscriptions',
  essential: false,
  needsReady: false,
  requires: ['GET /v1/channels/{id}/subscribers/me', 'POST /v1/channels/{id}/subscribers'],
  async run({ world, api, state }) {
    const tally = createTally();
    for (const spec of world.subscriptions) {
      const subscriber = userById(world, spec.subscriberId);
      const channelId = state.channelIds.get(spec.channelOwnerId);
      if (!subscriber || !channelId) continue;
      const actor = actorOf(subscriber);
      const mine = await api.send(
        { actor, method: 'GET', path: `/v1/channels/${channelId}/subscribers/me` },
        SubscriptionStateSchema
      );
      if (isErr(mine)) {
        tally.fail(mine.error);
        continue;
      }
      if (mine.value.subscribed) {
        tally.existing();
        continue;
      }
      const created = await api.send(
        { actor, method: 'POST', path: `/v1/channels/${channelId}/subscribers` },
        AnySchema
      );
      if (isErr(created)) tally.fail(created.error);
      else tally.created();
    }
    return tally.outcome('subscriptions');
  },
};
