import { createWatchPartyRepositories } from '../postgres-watch-party-repositories';
import type { PostgresDatabase } from '../types';

describe('createWatchPartyRepositories', () => {
  it('builds one repository for each watch party table family over the handle it is given', () => {
    const repositories = createWatchPartyRepositories({} as PostgresDatabase);

    expect(Object.keys(repositories).sort()).toEqual([
      'watchPartyControls',
      'watchPartyHousekeeping',
      'watchPartyInviteLinks',
      'watchPartyInvites',
      'watchPartyMembers',
      'watchPartyMessages',
      'watchPartyQueue',
      'watchPartyRoles',
      'watchPartyRooms',
    ]);
  });
});
