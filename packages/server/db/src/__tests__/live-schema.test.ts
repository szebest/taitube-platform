import { getTableConfig } from 'drizzle-orm/pg-core';
import { liveChatMessages, liveStreams } from '../live-schema';
import { referenceFrom } from './foreign-key';

const indexNames = (table: typeof liveStreams | typeof liveChatMessages) =>
  getTableConfig(table).indexes.map((index) => index.config.name);

describe('db: live schema', () => {
  it.each([
    {
      scenario: 'a deleted channel takes its streams',
      table: liveStreams,
      column: 'channel_id',
      reference: { table: 'channels', onDelete: 'cascade' },
    },
    {
      scenario: 'a purged archive video leaves the stream row behind',
      table: liveStreams,
      column: 'video_id',
      reference: { table: 'videos', onDelete: 'set null' },
    },
    {
      scenario: 'a stream takes its chat',
      table: liveChatMessages,
      column: 'live_stream_id',
      reference: { table: 'live_streams', onDelete: 'cascade' },
    },
    {
      scenario: 'a deleted user takes their chat messages',
      table: liveChatMessages,
      column: 'user_id',
      reference: { table: 'users', onDelete: 'cascade' },
    },
  ])('$scenario', ({ table, column, reference }) => {
    expect(referenceFrom(table, column)).toEqual(reference);
  });

  it('keys the stream key, and one open stream per channel, uniquely', () => {
    const unique = getTableConfig(liveStreams)
      .indexes.filter((index) => index.config.unique)
      .map((index) => index.config.name);
    expect(unique).toEqual(['live_streams_stream_key_key', 'live_streams_one_open_per_channel']);
  });

  it.each([
    { table: liveStreams, name: 'live_streams_channel_status_idx' },
    { table: liveStreams, name: 'live_streams_live_now_idx' },
    { table: liveChatMessages, name: 'live_chat_messages_stream_id_idx' },
    { table: liveChatMessages, name: 'live_chat_messages_stream_offset_idx' },
  ])('indexes $name', ({ table, name }) => {
    expect(indexNames(table)).toContain(name);
  });

  it.each([
    { table: liveStreams, checks: ['live_streams_slow_mode_check'] },
    {
      table: liveChatMessages,
      checks: ['live_chat_messages_length_check', 'live_chat_messages_offset_check'],
    },
  ])('guards $checks in the database', ({ table, checks }) => {
    expect(getTableConfig(table).checks.map((constraint) => constraint.name)).toEqual(checks);
  });
});
