import type { InMemoryOutboxRepository } from './in-memory-outbox-repository';
import type { InMemoryUserEventRepository } from './in-memory-user-event-repository';
import { InMemoryWatchPartyHousekeepingRepository } from './in-memory-watch-party-housekeeping-repository';
import { InMemoryWatchPartyInviteLinkRepository } from './in-memory-watch-party-invite-link-repository';
import { InMemoryWatchPartyInviteRepository } from './in-memory-watch-party-invite-repository';
import { InMemoryWatchPartyMemberRepository } from './in-memory-watch-party-member-repository';
import { InMemoryWatchPartyMessageRepository } from './in-memory-watch-party-message-repository';
import { InMemoryWatchPartyPersonalControlRepository } from './in-memory-watch-party-personal-control-repository';
import { InMemoryWatchPartyQueueRepository } from './in-memory-watch-party-queue-repository';
import { InMemoryWatchPartyRoleRepository } from './in-memory-watch-party-role-repository';
import { InMemoryWatchPartyRoomRepository } from './in-memory-watch-party-room-repository';
import { InMemoryWatchPartyStore } from './in-memory-watch-party-store';

/** The watch party repositories, which share one store and sit outside the graph. */
export class InMemoryWatchPartyRepositories {
  readonly watchPartyRooms: InMemoryWatchPartyRoomRepository;
  readonly watchPartyRoles: InMemoryWatchPartyRoleRepository;
  readonly watchPartyMembers: InMemoryWatchPartyMemberRepository;
  readonly watchPartyQueue: InMemoryWatchPartyQueueRepository;
  readonly watchPartyMessages: InMemoryWatchPartyMessageRepository;
  readonly watchPartyInvites: InMemoryWatchPartyInviteRepository;
  readonly watchPartyInviteLinks: InMemoryWatchPartyInviteLinkRepository;
  readonly watchPartyControls: InMemoryWatchPartyPersonalControlRepository;
  readonly watchPartyHousekeeping: InMemoryWatchPartyHousekeepingRepository;
  private readonly watchParties = new InMemoryWatchPartyStore();

  constructor(outbox: InMemoryOutboxRepository, userEvents: InMemoryUserEventRepository) {
    this.watchPartyRooms = new InMemoryWatchPartyRoomRepository(this.watchParties);
    this.watchPartyRoles = new InMemoryWatchPartyRoleRepository(this.watchParties);
    this.watchPartyMembers = new InMemoryWatchPartyMemberRepository(this.watchParties);
    this.watchPartyQueue = new InMemoryWatchPartyQueueRepository(this.watchParties);
    this.watchPartyMessages = new InMemoryWatchPartyMessageRepository(this.watchParties);
    this.watchPartyInvites = new InMemoryWatchPartyInviteRepository(this.watchParties, outbox);
    this.watchPartyInviteLinks = new InMemoryWatchPartyInviteLinkRepository(this.watchParties);
    this.watchPartyControls = new InMemoryWatchPartyPersonalControlRepository(
      this.watchParties,
      userEvents
    );
    this.watchPartyHousekeeping = new InMemoryWatchPartyHousekeepingRepository(this.watchParties);
  }

  clearWatchParties(): void {
    this.watchParties.clear();
  }
}
