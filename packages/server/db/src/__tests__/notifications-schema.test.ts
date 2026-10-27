import { getTableConfig } from 'drizzle-orm/pg-core';
import { notifications } from '../notifications-schema';
import { referenceFrom } from './foreign-key';

describe('db: notifications schema', () => {
  it.each([
    { column: 'user_id', table: 'users', onDelete: 'cascade' },
    { column: 'actor_channel_id', table: 'channels', onDelete: 'set null' },
    { column: 'video_id', table: 'videos', onDelete: 'cascade' },
    { column: 'comment_id', table: 'video_comments', onDelete: 'cascade' },
  ])('$column follows its $table row with $onDelete', ({ column, table, onDelete }) => {
    expect(referenceFrom(notifications, column)).toEqual({ table, onDelete });
  });

  it('indexes the newest-first list, the unread count and grouping, and the retention', () => {
    expect(getTableConfig(notifications).indexes.map((index) => index.config.name)).toEqual([
      'notifications_user_newest_idx',
      'notifications_user_unread_idx',
      'notifications_created_at_idx',
    ]);
  });
});
