import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { fromPromise, type Result } from '@kit/result';
import type { AccountAuditQuery, AccountAuditRepositoryPort } from '@vp/core/repositories';
import { accountAuditLog as log } from '@vp/db';
import type { AccountAuditEntry, NewAccountAuditEntry } from '@vp/domain';
import { and, desc, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { keysetBefore, msTimestamp } from '../scopes/index';
import type { PostgresDatabase } from './types';

export class PostgresAccountAuditRepository implements AccountAuditRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async append(
    entry: NewAccountAuditEntry
  ): Promise<Result<AccountAuditEntry, DatabaseUnavailable>> {
    return fromPromise(async () => {
      const [row] = await this.db
        .insert(log)
        .values({ id: uuidv7(), ...entry })
        .returning();
      if (!row) throw new Error('account audit insert returned no row');
      return row;
    }, databaseUnavailable.during('appendAccountAudit'));
  }

  async list(
    userId: string,
    { cursor, limit }: AccountAuditQuery
  ): Promise<Result<AccountAuditEntry[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(log)
          .where(
            and(
              eq(log.userId, userId),
              keysetBefore(
                msTimestamp(log.createdAt),
                log.id,
                cursor && { sort: cursor.createdAt, tie: cursor.id }
              )
            )
          )
          .orderBy(desc(msTimestamp(log.createdAt)), desc(log.id))
          .limit(limit + 1),
      databaseUnavailable.during('listAccountAudit')
    );
    return rows;
  }
}
