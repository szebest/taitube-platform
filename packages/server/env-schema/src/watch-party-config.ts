import { WATCH_PARTY } from './tuning';

interface Budget {
  limit: number;
  windowSeconds: number;
}

interface WatchPartyTuning {
  ticketTtlSeconds: number;
  guestCredentialTtlSeconds: number;
  presence: { keepaliveMs: number; staleAfterMs: number; keyTtlSeconds: number };
  ownerGraceMs: number;
  budgets: {
    create: Budget;
    command: Budget;
    reaction: Budget;
    request: Budget;
    chat: Budget;
    invite: Budget;
    guestCredential: Budget;
    guestJoin: Budget;
    password: Budget;
  };
  frameMaxBytes: number;
  /** The keepalive ping and the unsent bytes past which a slow socket is dropped. */
  socket: { pingIntervalMs: number; maxBufferedBytes: number };
  chatBacklog: number;
  inviteCandidates: number;
  reactionsFoldMs: number;
  rosterBatchMs: number;
  buffering: { waitAfterMs: number; maxWaitMs: number; maxRoomSize: number };
  scrypt: { N: number; r: number; p: number; keyLength: number; saltLength: number };
  messageRetentionDays: number;
  closedRoomRetentionDays: number;
}

export interface WatchPartyConfig extends WatchPartyTuning {
  /** The operator ceiling on a room's capacity: a room with none set holds this many. */
  maxMembers: number;
  maxOpenPerUser: number;
  /** Absent refuses every guest: a guest ban's IP hash has no key to be made with. */
  guestSalt: string | undefined;
}

/** The watch party keys as `toAppConfig` read them, given the tuning. */
export function watchPartyConfig(
  keys: Pick<WatchPartyConfig, 'maxMembers' | 'maxOpenPerUser' | 'guestSalt'>
): WatchPartyConfig {
  return { ...keys, ...WATCH_PARTY };
}
