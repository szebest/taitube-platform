import { getTableConfig } from 'drizzle-orm/pg-core';
import { channelSubscriptions, subscriptionEvents, videoReactions } from '../social-schema';
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
      column: 'subscriber_channel_id',
      references: 'channels',
    },
    {
      name: 'a subscription',
      table: channelSubscriptions,
      column: 'channel_id',
      references: 'channels',
    },
    {
      name: 'a subscription event',
      table: subscriptionEvents,
      column: 'channel_id',
      references: 'channels',
    },
  ])('drops $name with the $references row its $column names', ({ table, column, references }) => {
    expect(referenceFrom(table, column)).toEqual({ table: references, onDelete: 'cascade' });
  });

  it.each([
    { table: videoReactions, unique: 'video_reactions_user_id_video_id_unique' },
    {
      table: channelSubscriptions,
      unique: 'channel_subscriptions_subscriber_channel_channel_unique',
    },
  ])('holds one row per pair through $unique', ({ table, unique }) => {
    expect(getTableConfig(table).uniqueConstraints.map((constraint) => constraint.name)).toEqual([
      unique,
    ]);
  });

  it('refuses a channel subscribing to itself', () => {
    expect(getTableConfig(channelSubscriptions).checks.map((check) => check.name)).toEqual([
      'channel_subscriptions_not_self',
    ]);
  });

  it('keeps the subscription but forgets the video it came from when that video goes', () => {
    expect(referenceFrom(channelSubscriptions, 'source_video_id')).toEqual({
      table: 'videos',
      onDelete: 'set null',
    });
    expect(
      getTableConfig(channelSubscriptions).indexes.map((index) => index.config.name)
    ).toContain('channel_subscriptions_source_video_idx');
  });

  it('reads a channel subscription events in time order, each one a gain or a loss', () => {
    const config = getTableConfig(subscriptionEvents);

    expect(config.indexes.map((index) => index.config.name)).toEqual([
      'subscription_events_channel_occurred_idx',
    ]);
    expect(config.checks.map((constraint) => constraint.name)).toEqual([
      'subscription_events_delta_check',
    ]);
  });
});
