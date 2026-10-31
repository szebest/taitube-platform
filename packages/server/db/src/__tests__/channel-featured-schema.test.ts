import { getTableConfig } from 'drizzle-orm/pg-core';
import { channelFeaturedVideos } from '../channel-featured-schema';
import { referenceFrom } from './foreign-key';

describe('db: channel featured videos schema', () => {
  it.each([
    { scenario: 'a deleted channel takes its pins', column: 'channel_id', target: 'channels' },
    { scenario: 'a purged video leaves the shelf', column: 'video_id', target: 'videos' },
  ])('$scenario', ({ column, target }) => {
    expect(referenceFrom(channelFeaturedVideos, column)).toEqual({
      table: target,
      onDelete: 'cascade',
    });
  });

  it('keys a pin by channel and video, and a slot by channel and position', () => {
    const config = getTableConfig(channelFeaturedVideos);

    expect(config.primaryKeys.map((key) => key.columns.map((column) => column.name))).toEqual([
      ['channel_id', 'video_id'],
    ]);
    expect(config.uniqueConstraints.map((constraint) => constraint.name)).toEqual([
      'channel_featured_videos_channel_position_key',
    ]);
  });

  it('keeps the position inside the shelf in the database', () => {
    expect(getTableConfig(channelFeaturedVideos).checks.map((check) => check.name)).toEqual([
      'channel_featured_videos_position_check',
    ]);
  });
});
