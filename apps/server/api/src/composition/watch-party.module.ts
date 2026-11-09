import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { uuidv7 } from 'uuidv7';
import {
  WatchPartyBroadcaster,
  WatchPartyContextLoader,
  WatchPartyControlsService,
  type WatchPartyDeps,
  WatchPartyGuestService,
  WatchPartyInviteService,
  WatchPartyMemberService,
  WatchPartyQueueService,
  WatchPartyRoleService,
  type WatchPartySecrets,
  WatchPartyService,
} from '../services/index';
import { Services } from './service-tokens';

const TOKEN_BYTES = 32;

/** A per-room key, so a guest's IP hash in one room says nothing about the same guest in another. */
function secrets(guestSalt: string | undefined): WatchPartySecrets {
  return {
    newId: () => uuidv7(),
    newToken: () => randomBytes(TOKEN_BYTES).toString('base64url'),
    hashToken: (token) => createHash('sha256').update(token).digest('hex'),
    hashIp: (roomId, ip) =>
      guestSalt === undefined
        ? null
        : createHmac('sha256', createHmac('sha256', guestSalt).update(roomId).digest())
            .update(ip)
            .digest('hex'),
    random: Math.random,
  };
}

export function registerWatchPartyServices(c: Container): Container {
  const deps = (c: Container): WatchPartyDeps => {
    const config = c.get(Adapters.Config);
    return {
      repositories: c.get(Adapters.Repositories),
      gate: c.get(Adapters.WatchPartyGate),
      presence: c.get(Adapters.WatchPartyPresence),
      guestSessions: c.get(Adapters.PartyGuestSessions),
      hasher: c.get(Adapters.PasswordHasher),
      broadcaster: c.get(Services.WatchPartyBroadcaster),
      context: c.get(Services.WatchPartyContextLoader),
      config: config.watchParties,
      secrets: secrets(config.watchParties.guestSalt),
      webUrl: config.webUrl,
      cdn: config.cdn,
      logger: c.get(Services.Logger),
      now: () => new Date(),
    };
  };

  return c
    .provide(
      Services.WatchPartyBroadcaster,
      (c) => new WatchPartyBroadcaster(c.get(Adapters.Cache))
    )
    .provide(
      Services.WatchPartyContextLoader,
      (c) =>
        new WatchPartyContextLoader({
          repositories: c.get(Adapters.Repositories),
          now: () => new Date(),
        })
    )
    .provide(Services.WatchPartyService, (c) => new WatchPartyService(deps(c)))
    .provide(Services.WatchPartyGuestService, (c) => new WatchPartyGuestService(deps(c)))
    .provide(Services.WatchPartyRoleService, (c) => new WatchPartyRoleService(deps(c)))
    .provide(Services.WatchPartyMemberService, (c) => new WatchPartyMemberService(deps(c)))
    .provide(Services.WatchPartyQueueService, (c) => new WatchPartyQueueService(deps(c)))
    .provide(Services.WatchPartyInviteService, (c) => new WatchPartyInviteService(deps(c)))
    .provide(Services.WatchPartyControlsService, (c) => new WatchPartyControlsService(deps(c)));
}
