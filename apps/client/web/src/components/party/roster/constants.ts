import type { RosterSync } from './types';

export const SYNC_COPY = {
  lobby: 'party.rosterSyncLobby',
  in_sync: 'party.rosterSyncInSync',
  catching_up: 'party.rosterSyncCatchingUp',
  buffering: 'party.rosterSyncBuffering',
} as const satisfies Record<RosterSync, string>;
