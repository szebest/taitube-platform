import type { DatabaseUnavailable } from '@kit/errors';
import { ok, type Result } from '@kit/result';
import {
  EntityRevisionRepository,
  type ListRevisionsOptions,
  type NewEntityRevision,
} from '@vp/core/repositories';
import type { EntityRevision, EntityRevisionType } from '@vp/domain';
import { uuidv7 } from 'uuidv7';
import { type Clock, realClock } from './clock';

export class InMemoryEntityRevisionRepository extends EntityRevisionRepository {
  private readonly rows: EntityRevision[] = [];

  constructor(private readonly now: Clock = realClock) {
    super();
  }

  async append(revision: NewEntityRevision): Promise<Result<void, DatabaseUnavailable>> {
    const recorded = this.rows.some(
      (row) =>
        row.entityType === revision.entityType &&
        row.entityId === revision.entityId &&
        row.version === revision.version
    );
    if (!recorded) this.rows.push({ id: uuidv7(), createdAt: new Date(this.now()), ...revision });
    return ok();
  }

  async list(
    entityType: EntityRevisionType,
    entityId: string,
    { beforeVersion, limit }: ListRevisionsOptions
  ): Promise<Result<EntityRevision[], DatabaseUnavailable>> {
    const found = this.rows
      .filter(
        (row) =>
          row.entityType === entityType &&
          row.entityId === entityId &&
          (beforeVersion === null || row.version < beforeVersion)
      )
      .sort((a, b) => b.version - a.version)
      .slice(0, limit + 1);
    return ok(found.map((row) => ({ ...row })));
  }

  async get(
    entityType: EntityRevisionType,
    entityId: string,
    revisionId: string
  ): Promise<Result<EntityRevision | null, DatabaseUnavailable>> {
    const found = this.rows.find(
      (row) => row.id === revisionId && row.entityType === entityType && row.entityId === entityId
    );
    return ok(found ? { ...found } : null);
  }

  async prune(keep: number): Promise<Result<number, DatabaseUnavailable>> {
    const dropped = new Set<string>();
    const newestFirst = this.rows.toSorted((a, b) => b.version - a.version);
    const seen = new Map<string, number>();
    for (const row of newestFirst) {
      const history = `${row.entityType}:${row.entityId}`;
      const position = seen.get(history) ?? 0;
      seen.set(history, position + 1);
      if (position >= keep) dropped.add(row.id);
    }
    const kept = this.rows.filter((row) => !dropped.has(row.id));
    this.rows.splice(0, this.rows.length, ...kept);
    return ok(dropped.size);
  }

  clear(): void {
    this.rows.length = 0;
  }
}
