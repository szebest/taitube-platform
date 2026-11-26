import { getTableConfig } from 'drizzle-orm/pg-core';
import { accountAuditLog } from '../account-audit-schema';
import { referenceFrom } from './foreign-key';

describe('db: account audit schema', () => {
  it("drops a user's account audit rows with the user", () => {
    expect(referenceFrom(accountAuditLog, 'user_id')).toEqual({
      table: 'users',
      onDelete: 'cascade',
    });
  });

  it("reads a user's rows newest first through one index", () => {
    expect(getTableConfig(accountAuditLog).indexes.map((index) => index.config.name)).toEqual([
      'account_audit_log_user_newest_idx',
    ]);
  });
});
