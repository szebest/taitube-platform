import { getTableConfig } from 'drizzle-orm/pg-core';
import { videoComments } from '../comments-schema';
import { referenceFrom } from './foreign-key';

describe('db: comments schema', () => {
  it.each([
    { scenario: 'drops the comments of a deleted video', column: 'video_id', table: 'videos' },
    {
      scenario: 'drops the replies of a deleted comment',
      column: 'parent_id',
      table: 'video_comments',
    },
  ])('$scenario', ({ column, table }) => {
    expect(referenceFrom(videoComments, column)).toEqual({ table, onDelete: 'cascade' });
  });

  it.each([
    { scenario: 'a user', column: 'author_id', table: 'users' },
    { scenario: 'a channel', column: 'author_channel_id', table: 'channels' },
  ])('refuses to delete $scenario who still authors a comment', ({ column, table }) => {
    expect(referenceFrom(videoComments, column)).toEqual({ table, onDelete: 'no action' });
  });

  it('holds at most one live pinned comment per video', () => {
    const pinned = getTableConfig(videoComments).indexes.find(
      (index) => index.config.name === 'video_comments_one_pinned_per_video_idx'
    );

    expect(pinned?.config.unique).toBe(true);
    expect(pinned?.config.where).toBeDefined();
  });
});
