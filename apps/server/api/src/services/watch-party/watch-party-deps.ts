import type {
  PartyGuestSessionsPort,
  PasswordHasherPort,
  WatchPartyGatePort,
  WatchPartyPresencePort,
} from '@vp/core/ports';
import type { Repositories } from '@vp/core/repositories';
import type { CdnBase, WatchPartyConfig } from '@vp/env-schema';
import type { Logger } from '@vp/logger';
import type { WatchPartyBroadcaster } from './watch-party-broadcaster';
import type { WatchPartyContextLoader } from './watch-party-context';

type WatchPartyRepositories = Pick<
  Repositories,
  | 'watchPartyRooms'
  | 'watchPartyRoles'
  | 'watchPartyMembers'
  | 'watchPartyQueue'
  | 'watchPartyMessages'
  | 'watchPartyInvites'
  | 'watchPartyInviteLinks'
  | 'watchPartyControls'
  | 'watchPartyHousekeeping'
  | 'videos'
  | 'channels'
  | 'playlists'
  | 'subscriptions'
  | 'userPreferences'
  | 'search'
>;

/** Secrets and ids, made in the composition root so every service stays deterministic in a spec. */
export interface WatchPartySecrets {
  /** UUIDv7. */
  newId(): string;
  /** 32 random bytes, base64url: party credentials, invite link tokens, socket admissions. */
  newToken(): string;
  /** SHA-256 hex of a bearer token, the only form it is stored in. */
  hashToken(token: string): string;
  /** HMAC of a guest's IP under a per-room key, for a guest ban; `null` without a guest salt. */
  hashIp(roomId: string, ip: string): string | null;
  /** A number in [0, 1): guest nicknames. */
  random(): number;
}

/** What every watch party service is handed. */
export interface WatchPartyDeps {
  readonly repositories: WatchPartyRepositories;
  readonly gate: WatchPartyGatePort;
  readonly presence: WatchPartyPresencePort;
  readonly guestSessions: PartyGuestSessionsPort;
  readonly hasher: PasswordHasherPort;
  readonly broadcaster: WatchPartyBroadcaster;
  readonly context: WatchPartyContextLoader;
  readonly config: WatchPartyConfig;
  readonly secrets: WatchPartySecrets;
  /** The web origin invite links point at. */
  readonly webUrl: string;
  readonly cdn: CdnBase;
  readonly logger: Logger;
  readonly now: () => Date;
}
