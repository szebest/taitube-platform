import { isErr } from '@vp/result';
import { z } from 'zod';
import { AccountSchema } from '../responses';
import { type Scenario, actorOf } from '../scenario';
import { createTally } from '../tally';
import type { UserSpec } from '../world-types';

type Account = z.infer<typeof AccountSchema>;

function profileChanges(user: UserSpec, { channel }: Account, now: number): Record<string, string> {
  const handleLocked =
    channel.handleChangeAvailableAt != null && Date.parse(channel.handleChangeAvailableAt) > now;
  const wanted: Record<string, string | null> = {
    displayName: user.displayName,
    handle: handleLocked ? channel.handle : user.handle,
    bio: user.bio,
    brandColor: user.ownsChannel ? user.brandColor : null,
  };
  const current: Record<string, string | null | undefined> = {
    displayName: channel.displayName,
    handle: channel.handle,
    bio: channel.bio,
    brandColor: channel.brandColor,
  };
  return Object.fromEntries(
    Object.entries(wanted).filter(
      (entry): entry is [string, string] => entry[1] !== null && entry[1] !== current[entry[0]]
    )
  );
}

export const channels: Scenario = {
  name: 'channels',
  essential: true,
  needsReady: false,
  requires: ['GET /v1/me/account', 'PATCH /v1/me/channel'],
  async run({ world, api, ports, state }) {
    const tally = createTally();
    for (const user of world.users) {
      const actor = actorOf(user);
      const account = await api.send(
        { actor, method: 'GET', path: '/v1/me/account' },
        AccountSchema
      );
      if (isErr(account)) {
        tally.fail(account.error);
        continue;
      }
      state.channelIds.set(user.id, account.value.channel.id);
      const changes = profileChanges(user, account.value, ports.clock.now());
      if (Object.keys(changes).length === 0) {
        tally.existing();
        continue;
      }
      const patched = await api.send(
        { actor, method: 'PATCH', path: '/v1/me/channel', json: changes },
        z.unknown()
      );
      if (isErr(patched)) tally.fail(patched.error);
      else tally.created();
    }
    return tally.outcome('channel profiles');
  },
};
