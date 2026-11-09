import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Adapters } from '@vp/adapters/composition';
import type { Container } from '@vp/composition';
import { WATCH_PARTY_WILDCARD_CHANNEL, roomIdOfWatchParty } from '@vp/events';
import { uuidv7 } from 'uuidv7';
import {
  BufferingWait,
  flushReactions,
  flushRoster,
  OwnerGrace,
  RoomBatcher,
  RoomEnvelopeSchema,
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
  WatchPartySocketService,
  WatchPartySweep,
} from '../services/index';
import { PatternHub } from '../services/pattern-hub';
import { Poller } from '../services/poller';
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
    .provide(Services.WatchPartyControlsService, (c) => new WatchPartyControlsService(deps(c)))
    .provide(
      Services.WatchPartyHub,
      (c) =>
        new PatternHub({
          cache: c.get(Adapters.Cache),
          logger: c.get(Services.Logger),
          pattern: WATCH_PARTY_WILDCARD_CHANNEL,
          keyOf: roomIdOfWatchParty,
          schema: RoomEnvelopeSchema,
        }),
      { start: (hub) => hub.init(), dispose: (hub) => hub.close() }
    )
    .provide(
      Services.WatchPartyReactions,
      (c) =>
        new RoomBatcher({
          windowMs: deps(c).config.reactionsFoldMs,
          flush: flushReactions(deps(c)),
        }),
      { dispose: (batcher) => batcher.close() }
    )
    .provide(
      Services.WatchPartyRoster,
      (c) =>
        new RoomBatcher({ windowMs: deps(c).config.rosterBatchMs, flush: flushRoster(deps(c)) }),
      { dispose: (batcher) => batcher.close() }
    )
    .provide(
      Services.WatchPartySweep,
      (c) => {
        const sweepDeps = deps(c);
        const sweep = new WatchPartySweep(sweepDeps);
        return new Poller(async () => {
          const swept = await sweep.run();
          if (!swept.ok) sweepDeps.logger.warn({ err: swept.error }, 'watch party sweep failed');
        }, sweepDeps.config.sweep.intervalMs);
      },
      { start: (poller) => poller.start(), dispose: (poller) => poller.stop() }
    )
    .provide(Services.WatchPartyBuffering, (c) => new BufferingWait(deps(c)), {
      dispose: (wait) => wait.close(),
    })
    .provide(Services.WatchPartyOwnerGrace, (c) => new OwnerGrace(deps(c)), {
      dispose: (grace) => grace.close(),
    })
    .provide(
      Services.WatchPartySocketService,
      (c) =>
        new WatchPartySocketService({
          ...deps(c),
          hub: c.get(Services.WatchPartyHub),
          allowedOrigins: c.get(Adapters.Config).http.corsOrigins,
          reactions: c.get(Services.WatchPartyReactions),
          roster: c.get(Services.WatchPartyRoster),
          buffering: c.get(Services.WatchPartyBuffering),
          ownerGrace: c.get(Services.WatchPartyOwnerGrace),
        })
    );
}
