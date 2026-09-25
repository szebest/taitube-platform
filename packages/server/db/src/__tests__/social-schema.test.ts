import { getTableConfig } from 'drizzle-orm/pg-core';
import { channelSubscriptions, videoReactions } from '../social-schema';
import { referenceFrom } from './foreign-key';

describe('db: social schema', () => {
  it.each([
    { name: 'a reaction', table: videoReactions, column: 'video_id', references: 'videos' },
    { name: 'a reaction', table: videoReactions, column: 'user_id', references: 'users' },
    {
      name: 'a subscription',
      table: channelSubscriptions,
      column: 'subscriber_id',
      references: 'users',
    },
    {
      name: 'a subscription',
      table: channelSubscriptions,
      column: 'channel_id',
      references: 'channels',
    },
  ])('drops $name with the $references row its $column names', ({ table, column, references }) => {
    expect(referenceFrom(table, column)).toEqual({ table: references, onDelete: 'cascade' });
  });

  it.each([
    { table: videoReactions, unique: 'video_reactions_user_id_video_id_unique' },
    { table: channelSubscriptions, unique: 'channel_subscriptions_subscriber_channel_unique' },
  ])('holds one row per pair through $unique', ({ table, unique }) => {
    expect(getTableConfig(table).uniqueConstraints.map((constraint) => constraint.name)).toEqual([
      unique,
    ]);
  });
});
