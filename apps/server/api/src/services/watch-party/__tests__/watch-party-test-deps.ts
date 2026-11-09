import { createHash } from 'node:crypto';
import { ScryptPasswordHasher } from '@vp/adapters';
import {
  InMemoryCacheClient,
  InMemoryPartyGuestSessions,
  InMemoryRepositories,
  InMemoryWatchPartyGate,
  InMemoryWatchPartyPresence,
} from '@vp/adapters/in-memory';
import type {
  CreateWatchPartyBody,
  WatchPartyServerFrame,
  WatchPartyView,
} from '@vp/api-contracts';
import type { PartyGuestSession } from '@vp/core/ports';
import { type AppConfigOverrides, asCdnBase, inProcessAppConfig } from '@vp/env-schema';
import { createLogger } from '@vp/logger';
import type { UserContext } from '@vp/permissions';
import { captureLog } from '@vp/testing/log-capture';
import { expectOk } from '@vp/testing/result';
import type { PartyCaller } from '../party-caller';
import { WatchPartyBroadcaster } from '../watch-party-broadcaster';
import { WatchPartyContextLoader } from '../watch-party-context';
import type { WatchPartyDeps, WatchPartySecrets } from '../watch-party-deps';
import { WatchPartyService } from '../watch-party-service';

export const TEST_SCRYPT = { N: 16, r: 8, p: 1, keyLength: 32, saltLength: 16 } as const;

export const START = Date.parse('2026-03-01T12:00:00.000Z');

export const OWNER: UserContext = { id: '00000000-0000-7000-8000-00000000f001', role: 'USER' };
export const MEMBER: UserContext = { id: '00000000-0000-7000-8000-00000000f002', role: 'USER' };
export const OTHER: UserContext = { id: '00000000-0000-7000-8000-00000000f003', role: 'USER' };
export const MODERATOR: UserContext = {
  id: '00000000-0000-7000-8000-00000000f004',
  role: 'MODERATOR',
};

export const DISCORD_ID = '123456789012345678';

export const GUEST_IP = '203.0.113.7';

/** The config an in-process app runs on, with the password hash cost cut so a spec stays fast. */
export function watchPartyTestConfig(overrides: AppConfigOverrides = {}) {
  const { watchParties, ...rest } = overrides;
  return inProcessAppConfig({
    ...rest,
    watchParties: { ...watchParties, scrypt: { ...TEST_SCRYPT } },
  });
}

export interface TestClock {
  nowMs: number;
  advance(ms: number): void;
}

export interface PublishedFrame {
  readonly channel: string;
  readonly memberKey: string | null;
  readonly frame: WatchPartyServerFrame;
}

export interface WatchPartyTestOptions {
  config?: AppConfigOverrides;
  secrets?: Partial<WatchPartySecrets>;
}

/** Counters make ids and tokens distinct and repeatable; tokens are long enough to be guest ids. */
function deterministicSecrets(guestSalt: string | undefined): WatchPartySecrets {
  let ids = 0;
  let tokens = 0;
  return {
    newId: () => `018f0000-0000-7000-8000-${String((ids += 1)).padStart(12, '0')}`,
    newToken: () => `token${String((tokens += 1)).padStart(20, '0')}`,
    hashToken: (token) => createHash('sha256').update(token).digest('hex'),
    hashIp: (roomId, ip) => (guestSalt === undefined ? null : `ip:${roomId}:${ip}`),
    random: () => 0.5,
  };
}

/**
 * Every collaborator a watch party service takes, in memory: the real repositories, gate, presence
 * and guest sessions on one fixed clock, a cheap scrypt hasher, and a broadcaster whose frames
 * `frames()` reads back.
 */
export function watchPartyTestDeps({ config, secrets }: WatchPartyTestOptions = {}) {
  const appConfig = watchPartyTestConfig(config);
  const clock: TestClock = {
    nowMs: START,
    advance(ms) {
      this.nowMs += ms;
    },
  };
  const now = () => new Date(clock.nowMs);
  const repositories = new InMemoryRepositories();
  const gate = new InMemoryWatchPartyGate(() => clock.nowMs);
  const presence = new InMemoryWatchPartyPresence();
  const guestSessions = new InMemoryPartyGuestSessions(() => clock.nowMs);
  const cache = new InMemoryCacheClient();
  const log = captureLog();

  const deps: WatchPartyDeps = {
    repositories,
    gate,
    presence,
    guestSessions,
    hasher: new ScryptPasswordHasher(appConfig.watchParties.scrypt),
    broadcaster: new WatchPartyBroadcaster(cache),
    context: new WatchPartyContextLoader({ repositories, now }),
    config: appConfig.watchParties,
    secrets: { ...deterministicSecrets(appConfig.watchParties.guestSalt), ...secrets },
    webUrl: 'http://localhost:5173',
    cdn: asCdnBase('http://localhost:9000/public'),
    logger: createLogger({
      service: 'watch-party-test',
      level: 'info',
      format: 'json',
      destination: log.destination,
    }),
    now,
  };

  const frames = (): PublishedFrame[] =>
    cache.publishedMessages.map(({ channel, message }) => ({
      channel,
      ...(JSON.parse(message) as Pick<PublishedFrame, 'memberKey' | 'frame'>),
    }));

  return { deps, repositories, gate, presence, guestSessions, cache, clock, log, frames };
}

export type WatchPartyTest = ReturnType<typeof watchPartyTestDeps>;

export function userCaller(user: UserContext, ip = '198.51.100.1'): PartyCaller {
  return { user, party: null, ip };
}

export function guestCaller(session: PartyGuestSession, ip = GUEST_IP): PartyCaller {
  return { user: null, party: session, ip };
}

export const ANONYMOUS: PartyCaller = { user: null, party: null, ip: GUEST_IP };

export function discordSession(discordUserId = DISCORD_ID): PartyGuestSession {
  return {
    principal: { kind: 'discord', discordUserId, name: 'Discord Dana', avatarUrl: null },
    ipHash: null,
  };
}

export const VIDEO_A = '018f0000-0000-7000-8000-00000000b001';
export const VIDEO_B = '018f0000-0000-7000-8000-00000000b002';
export const VIDEO_C = '018f0000-0000-7000-8000-00000000b003';
export const VIDEO_PRIVATE = '018f0000-0000-7000-8000-00000000b0f1';
export const VIDEO_UNLISTED = '018f0000-0000-7000-8000-00000000b0f2';

/** A channel for each account and three public videos plus a private and an unlisted one, all the owner's. */
export async function seedParty({ repositories }: WatchPartyTest): Promise<void> {
  const accounts = [
    [OWNER, 'owner', 'Olivia Owner'],
    [MEMBER, 'member', 'Max Member'],
    [OTHER, 'other', 'Oscar Other'],
    [MODERATOR, 'moderator', 'Mona Moderator'],
  ] as const;
  for (const [{ id }, handle, displayName] of accounts) {
    expectOk(await repositories.channels.create({ userId: id, handle, displayName }));
  }
  const videos = [
    [VIDEO_A, 'First', 'public'],
    [VIDEO_B, 'Second', 'public'],
    [VIDEO_C, 'Third', 'public'],
    [VIDEO_PRIVATE, 'Hidden', 'private'],
    [VIDEO_UNLISTED, 'Quiet', 'unlisted'],
  ] as const;
  for (const [id, title, visibility] of videos) {
    expectOk(
      await repositories.videos.create({
        id,
        ownerId: OWNER.id,
        title,
        visibility,
        status: 'READY',
        sourceKey: `raw/${id}/source.mp4`,
      })
    );
  }
}

export type PartyBodyOverrides = Partial<CreateWatchPartyBody>;

export function partyBody(overrides: PartyBodyOverrides = {}): CreateWatchPartyBody {
  return { visibility: 'unlisted', preset: 'friends', hostAs: 'user', ...overrides };
}

/** A room made through the real create path, by the owner unless said otherwise. */
export async function startParty(
  { deps }: WatchPartyTest,
  overrides: PartyBodyOverrides = {},
  owner: UserContext = OWNER
): Promise<WatchPartyView> {
  return expectOk(
    await new WatchPartyService(deps).create(userCaller(owner), partyBody(overrides))
  );
}
