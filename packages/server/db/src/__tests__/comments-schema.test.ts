import { getTableConfig } from 'drizzle-orm/pg-core';
import { comments } from '../comments-schema';
import { referenceFrom } from './foreign-key';

describe('db: comments schema', () => {
  it.each([
    { scenario: 'drops the replies of a deleted comment', column: 'parent_id', table: 'comments' },
    {
      scenario: 'drops the comments of a deleted channel',
      column: 'channel_id',
      table: 'channels',
    },
  ])('$scenario', ({ column, table }) => {
    expect(referenceFrom(comments, column)).toEqual({ table, onDelete: 'cascade' });
  });

  it('holds no foreign key on the target, which its own trigger cleans up', () => {
    expect(referenceFrom(comments, 'target_id')).toEqual({ table: undefined, onDelete: undefined });
  });

  it.each([
    { scenario: 'a user', column: 'author_id', table: 'users' },
    { scenario: 'a channel', column: 'author_channel_id', table: 'channels' },
  ])('refuses to delete $scenario who still authors a comment', ({ column, table }) => {
    expect(referenceFrom(comments, column)).toEqual({ table, onDelete: 'no action' });
  });

  it('holds at most one live pinned comment per target', () => {
    const pinned = getTableConfig(comments).indexes.find(
      (index) => index.config.name === 'comments_one_pinned_per_target_idx'
    );

    expect(pinned?.config.unique).toBe(true);
    expect(pinned?.config.where).toBeDefined();
  });
});
