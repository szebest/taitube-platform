import { createChannelRepositories } from '../postgres-channel-repositories';
import type { PostgresDatabase } from '../types';

describe('createChannelRepositories', () => {
  it('builds one repository for each channel table family over the handle it is given', () => {
    const repositories = createChannelRepositories({} as PostgresDatabase);

    expect(Object.keys(repositories).sort()).toEqual([
      'channelAudit',
      'channelFeatured',
      'channelHandleHistory',
      'channelImages',
      'channelInvites',
      'channelMembers',
      'channelPages',
      'channelPosts',
      'channels',
    ]);
  });
});
