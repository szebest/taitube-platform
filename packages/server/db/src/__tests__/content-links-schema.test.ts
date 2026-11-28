import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  channelLinkSettings,
  contentLinkDismissals,
  contentLinkStatsDaily,
  contentLinks,
  videoEndScreens,
} from '../content-links-schema';
import { referenceFrom } from './foreign-key';

describe('db: content links schema', () => {
  it.each([
    { table: contentLinks, column: 'source_channel_id', target: 'channels', onDelete: 'cascade' },
    { table: contentLinks, column: 'target_channel_id', target: 'channels', onDelete: 'cascade' },
    { table: contentLinks, column: 'decided_by', target: 'users', onDelete: 'set null' },
    { table: contentLinkDismissals, column: 'channel_id', target: 'channels', onDelete: 'cascade' },
    {
      table: contentLinkStatsDaily,
      column: 'link_id',
      target: 'content_links',
      onDelete: 'cascade',
    },
    { table: videoEndScreens, column: 'video_id', target: 'videos', onDelete: 'cascade' },
    { table: channelLinkSettings, column: 'channel_id', target: 'channels', onDelete: 'cascade' },
  ])(
    '$column of $table points at $target, on delete $onDelete',
    ({ table, column, target, onDelete }) => {
      expect(referenceFrom(table, column)).toEqual({ table: target, onDelete });
    }
  );

  it('keeps one link per source, target and relation and indexes both directions and the queue', () => {
    expect(getTableConfig(contentLinks).indexes.map((index) => index.config.name)).toEqual([
      'content_links_source_target_relation_unique',
      'content_links_source_idx',
      'content_links_target_idx',
      'content_links_queue_idx',
      'content_links_source_channel_idx',
    ]);
  });
});
