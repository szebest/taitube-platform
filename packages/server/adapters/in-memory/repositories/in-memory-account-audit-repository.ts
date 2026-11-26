import { ok, type Result } from '@kit/result';
import type { AccountAuditQuery, AccountAuditRepositoryPort } from '@vp/core/repositories';
import type { AccountAuditEntry, NewAccountAuditEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { uuidv7 } from 'uuidv7';
import { byKeysetDesc, isKeysetBefore } from './keyset';

const keysetOf = ({ createdAt, id }: AccountAuditEntry) => ({ sort: createdAt, tie: id });

export class InMemoryAccountAuditRepository implements AccountAuditRepositoryPort {
  private rows: AccountAuditEntry[] = [];

  async append(
    entry: NewAccountAuditEntry
  ): Promise<Result<AccountAuditEntry, DatabaseUnavailable>> {
    const row: AccountAuditEntry = { ...entry, id: uuidv7(), createdAt: new Date() };
    this.rows.push(row);
    return ok({ ...row });
  }

  async list(
    userId: string,
    { cursor, limit }: AccountAuditQuery
  ): Promise<Result<AccountAuditEntry[], DatabaseUnavailable>> {
    const after = cursor && { sort: cursor.createdAt, tie: cursor.id };
    return ok(
      this.rows
        .filter((row) => row.userId === userId && isKeysetBefore(keysetOf(row), after))
        .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)))
        .slice(0, limit + 1)
        .map((row) => ({ ...row }))
    );
  }

  clear(): void {
    this.rows = [];
  }
}
