import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  channelPosts,
  postPollVotes,
  postReactions,
  postStatsDaily,
  videoThreads,
} from '../posts-schema';
import { referenceFrom } from './foreign-key';

describe('db: posts schema', () => {
  it.each([
    {
      table: channelPosts,
      source: getTableConfig(channelPosts).name,
      column: 'channel_id',
      target: 'channels',
      onDelete: 'cascade',
    },
    {
      table: channelPosts,
      source: getTableConfig(channelPosts).name,
      column: 'author_user_id',
      target: 'users',
      onDelete: 'no action',
    },
    {
      table: postReactions,
      source: getTableConfig(postReactions).name,
      column: 'post_id',
      target: 'channel_posts',
      onDelete: 'cascade',
    },
    {
      table: postReactions,
      source: getTableConfig(postReactions).name,
      column: 'user_id',
      target: 'users',
      onDelete: 'cascade',
    },
    {
      table: postPollVotes,
      source: getTableConfig(postPollVotes).name,
      column: 'post_id',
      target: 'channel_posts',
      onDelete: 'cascade',
    },
    {
      table: postPollVotes,
      source: getTableConfig(postPollVotes).name,
      column: 'user_id',
      target: 'users',
      onDelete: 'cascade',
    },
    {
      table: postStatsDaily,
      source: getTableConfig(postStatsDaily).name,
      column: 'post_id',
      target: 'channel_posts',
      onDelete: 'cascade',
    },
    {
      table: videoThreads,
      source: getTableConfig(videoThreads).name,
      column: 'video_id',
      target: 'videos',
      onDelete: 'cascade',
    },
    {
      table: videoThreads,
      source: getTableConfig(videoThreads).name,
      column: 'author_id',
      target: 'users',
      onDelete: 'no action',
    },
  ])(
    '$column of $source points at $target, on delete $onDelete',
    ({ table, column, target, onDelete }) => {
      expect(referenceFrom(table, column)).toEqual({ table: target, onDelete });
    }
  );

  it('casts one final vote per viewer and post', () => {
    expect(getTableConfig(postPollVotes).uniqueConstraints.map((unique) => unique.name)).toEqual([
      'post_poll_votes_post_user_unique',
    ]);
  });

  it('keeps the payload kind and the kind column the same', () => {
    expect(getTableConfig(channelPosts).checks.map((check) => check.name)).toContain(
      'channel_posts_kind_matches_payload'
    );
  });
});
