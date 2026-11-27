import { channelLayoutDrafts, channelLayoutSchedules } from '../channel-layout-schema';
import { referenceFrom } from './foreign-key';

describe('db: channel layout schema', () => {
  it.each([
    {
      scenario: 'a deleted channel takes its draft',
      table: channelLayoutDrafts,
      column: 'channel_id',
      target: 'channels',
      onDelete: 'cascade',
    },
    {
      scenario: 'a deleted channel takes its schedules',
      table: channelLayoutSchedules,
      column: 'channel_id',
      target: 'channels',
      onDelete: 'cascade',
    },
    {
      scenario: 'a deleted author keeps the draft',
      table: channelLayoutDrafts,
      column: 'updated_by',
      target: 'users',
      onDelete: 'set null',
    },
  ])('$scenario', ({ table, column, target, onDelete }) => {
    expect(referenceFrom(table, column)).toEqual({ table: target, onDelete });
  });
});
