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

  it('refuses to delete a user who still authors a comment', () => {
    expect(referenceFrom(videoComments, 'author_id')).toEqual({
      table: 'users',
      onDelete: 'no action',
    });
  });

  it('holds at most one live pinned comment per video', () => {
    const pinned = getTableConfig(videoComments).indexes.find(
      (index) => index.config.name === 'video_comments_one_pinned_per_video_idx'
    );

    expect(pinned?.config.unique).toBe(true);
    expect(pinned?.config.where).toBeDefined();
  });
});
