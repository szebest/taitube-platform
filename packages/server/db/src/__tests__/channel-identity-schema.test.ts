import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  channelHandleHistory,
  channelImageUploads,
  channelLocalizations,
  channelPageSettings,
} from '../channel-identity-schema';
import { referenceFrom } from './foreign-key';

describe('db: channel identity schema', () => {
  it.each([
    { table: channelHandleHistory, column: 'channel_id', target: 'channels', onDelete: 'cascade' },
    { table: channelImageUploads, column: 'channel_id', target: 'channels', onDelete: 'cascade' },
    { table: channelImageUploads, column: 'uploaded_by', target: 'users', onDelete: 'cascade' },
    { table: channelPageSettings, column: 'channel_id', target: 'channels', onDelete: 'cascade' },
    {
      table: channelPageSettings,
      column: 'trailer_video_id',
      target: 'videos',
      onDelete: 'set null',
    },
    {
      table: channelPageSettings,
      column: 'returning_video_id',
      target: 'videos',
      onDelete: 'set null',
    },
    { table: channelLocalizations, column: 'channel_id', target: 'channels', onDelete: 'cascade' },
    {
      table: channelLocalizations,
      column: 'trailer_video_id',
      target: 'videos',
      onDelete: 'set null',
    },
  ])('references $target from $column and $onDelete', ({ table, column, target, onDelete }) => {
    expect(referenceFrom(table, column)).toEqual({ table: target, onDelete });
  });

  it('holds a retired handle once, whoever owned it', () => {
    expect(getTableConfig(channelHandleHistory).columns.find((c) => c.primary)?.name).toBe(
      'handle'
    );
  });

  it('numbers an image once per channel and kind, and checks kind and status in the database', () => {
    const config = getTableConfig(channelImageUploads);

    expect(config.uniqueConstraints.map((constraint) => constraint.name)).toEqual([
      'channel_image_uploads_version_key',
    ]);
    expect(config.checks.map((check) => check.name)).toEqual([
      'channel_image_uploads_kind_check',
      'channel_image_uploads_status_check',
    ]);
  });

  it('keys a localization by channel and locale', () => {
    expect(
      getTableConfig(channelLocalizations).primaryKeys.map((key) =>
        key.columns.map((column) => column.name)
      )
    ).toEqual([['channel_id', 'locale']]);
  });
});
