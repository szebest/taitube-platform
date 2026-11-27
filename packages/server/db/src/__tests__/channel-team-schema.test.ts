import { getTableConfig } from 'drizzle-orm/pg-core';
import { channelAuditLog, channelInvites, channelMembers } from '../channel-team-schema';
import { referenceFrom } from './foreign-key';

describe('db: channel team schema', () => {
  it.each([
    { table: channelMembers, column: 'channel_id', target: 'channels', onDelete: 'cascade' },
    { table: channelMembers, column: 'user_id', target: 'users', onDelete: 'cascade' },
    { table: channelMembers, column: 'invited_by', target: 'users', onDelete: 'set null' },
    { table: channelInvites, column: 'invitee_user_id', target: 'users', onDelete: 'cascade' },
    { table: channelInvites, column: 'invited_by', target: 'users', onDelete: 'set null' },
    { table: channelAuditLog, column: 'channel_id', target: 'channels', onDelete: 'cascade' },
    { table: channelAuditLog, column: 'actor_user_id', target: 'users', onDelete: 'set null' },
  ])(
    '$column of $table.name points at $target, on delete $onDelete',
    ({ table, column, target, onDelete }) => {
      expect(referenceFrom(table, column)).toEqual({ table: target, onDelete });
    }
  );

  it('keys a membership by channel and user, so the owner is never a row and a user joins once', () => {
    expect(
      getTableConfig(channelMembers).primaryKeys.map((key) => key.columns.map((c) => c.name))
    ).toEqual([['channel_id', 'user_id']]);
  });

  it('allows one pending invite per channel and invitee', () => {
    const pending = getTableConfig(channelInvites).indexes.find(
      (index) => index.config.name === 'channel_invites_one_pending_idx'
    );

    expect(pending?.config.unique).toBe(true);
  });

  it('guards roles and statuses in the database but leaves audit actions open', () => {
    expect(
      [channelMembers, channelInvites, channelAuditLog].flatMap((table) =>
        getTableConfig(table).checks.map((constraint) => constraint.name)
      )
    ).toEqual([
      'channel_members_role_check',
      'channel_invites_role_check',
      'channel_invites_status_check',
    ]);
  });
});
