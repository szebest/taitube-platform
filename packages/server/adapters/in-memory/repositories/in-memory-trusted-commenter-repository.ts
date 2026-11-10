import type {
  TrustedCommenter,
  TrustedCommenterQuery,
  TrustedCommenterRepositoryPort,
} from '@vp/core/repositories';
import type { NewChannelAuditEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result } from '@vp/result';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import { byKeysetDesc, isKeysetBefore } from './keyset';

const keyOf = (channelId: string, userId: string) => `${channelId}:${userId}`;

const keysetOf = ({ createdAt, userId }: TrustedCommenter) => ({ sort: createdAt, tie: userId });

export class InMemoryTrustedCommenterRepository implements TrustedCommenterRepositoryPort {
  private readonly rows = new Map<string, TrustedCommenter>();

  constructor(
    private readonly deps: { auditRepo: Pick<InMemoryChannelAuditRepository, 'append'> }
  ) {}

  async isTrusted(
    channelId: string,
    userId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(this.rows.has(keyOf(channelId, userId)));
  }

  async add(
    channelId: string,
    userId: string,
    createdBy: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const key = keyOf(channelId, userId);
    if (this.rows.has(key)) return ok(false);
    this.rows.set(key, { channelId, userId, createdBy, createdAt: new Date() });
    return this.record(true, audit);
  }

  async remove(
    channelId: string,
    userId: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return this.record(this.rows.delete(keyOf(channelId, userId)), audit);
  }

  async list(
    channelId: string,
    { cursor, limit }: TrustedCommenterQuery
  ): Promise<Result<TrustedCommenter[], DatabaseUnavailable>> {
    const after = cursor && { sort: cursor.createdAt, tie: cursor.userId };
    return ok(
      [...this.rows.values()]
        .filter((row) => row.channelId === channelId && isKeysetBefore(keysetOf(row), after))
        .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)))
        .slice(0, limit + 1)
        .map((row) => ({ ...row }))
    );
  }

  private async record(
    changed: boolean,
    audit?: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const audited = changed && audit && (await this.deps.auditRepo.append(audit));
    return audited && isErr(audited) ? audited : ok(changed);
  }

  clear(): void {
    this.rows.clear();
  }
}
