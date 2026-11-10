import { PostgresWatchPartyHousekeepingRepository } from './postgres-watch-party-housekeeping-repository';
import { PostgresWatchPartyInviteLinkRepository } from './postgres-watch-party-invite-link-repository';
import { PostgresWatchPartyInviteRepository } from './postgres-watch-party-invite-repository';
import { PostgresWatchPartyMemberRepository } from './postgres-watch-party-member-repository';
import { PostgresWatchPartyMessageRepository } from './postgres-watch-party-message-repository';
import { PostgresWatchPartyPersonalControlRepository } from './postgres-watch-party-personal-control-repository';
import { PostgresWatchPartyQueueRepository } from './postgres-watch-party-queue-repository';
import { PostgresWatchPartyRoleRepository } from './postgres-watch-party-role-repository';
import { PostgresWatchPartyRoomRepository } from './postgres-watch-party-room-repository';
import type { PostgresDatabase } from './types';

export function createWatchPartyRepositories(db: PostgresDatabase) {
  return {
    watchPartyRooms: new PostgresWatchPartyRoomRepository(db),
    watchPartyRoles: new PostgresWatchPartyRoleRepository(db),
    watchPartyMembers: new PostgresWatchPartyMemberRepository(db),
    watchPartyQueue: new PostgresWatchPartyQueueRepository(db),
    watchPartyMessages: new PostgresWatchPartyMessageRepository(db),
    watchPartyInvites: new PostgresWatchPartyInviteRepository(db),
    watchPartyInviteLinks: new PostgresWatchPartyInviteLinkRepository(db),
    watchPartyControls: new PostgresWatchPartyPersonalControlRepository(db),
    watchPartyHousekeeping: new PostgresWatchPartyHousekeepingRepository(db),
  };
}

export type WatchPartyRepositories = ReturnType<typeof createWatchPartyRepositories>;
