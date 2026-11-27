import { type DatabaseUnavailable, databaseUnavailable } from '@kit/errors';
import { fromPromise, map, type Result } from '@kit/result';
import {
  EntityRevisionRepository,
  type ListRevisionsOptions,
  type NewEntityRevision,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { EntityRevision, EntityRevisionType } from '@vp/domain';
import { and, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { drizzleWhere } from '../scopes/index';
import type { PostgresDatabase } from './types';
import { appendEntityRevision, toEntityRevision } from './video-revision-writes';

const { entityRevisions: er } = schema;

export class PostgresEntityRevisionRepository extends EntityRevisionRepository {
  constructor(private readonly db: PostgresDatabase) {
    super();
  }

  async append(revision: NewEntityRevision): Promise<Result<void, DatabaseUnavailable>> {
    return fromPromise(
      () => appendEntityRevision(this.db, revision),
      databaseUnavailable.during('appendEntityRevision')
    );
  }

  async list(
    entityType: EntityRevisionType,
    entityId: string,
    { beforeVersion, limit }: ListRevisionsOptions
  ): Promise<Result<EntityRevision[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(er)
          .where(
            drizzleWhere(
              eq(er.entityType, entityType),
              eq(er.entityId, entityId),
              beforeVersion === null ? undefined : lt(er.version, beforeVersion)
            )
          )
          .orderBy(desc(er.version))
          .limit(limit + 1),
      databaseUnavailable.during('listEntityRevisions')
    );
    return map(rows, (found) => found.map(toEntityRevision));
  }

  async get(
    entityType: EntityRevisionType,
    entityId: string,
    revisionId: string
  ): Promise<Result<EntityRevision | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(er)
          .where(
            and(eq(er.id, revisionId), eq(er.entityType, entityType), eq(er.entityId, entityId))
          )
          .limit(1),
      databaseUnavailable.during('getEntityRevision')
    );
    return map(rows, ([found]) => (found ? toEntityRevision(found) : null));
  }

  async prune(keep: number): Promise<Result<number, DatabaseUnavailable>> {
    const ranked = this.db
      .select({
        id: er.id,
        rank: sql<number>`row_number() over (partition by ${er.entityType}, ${er.entityId} order by ${er.version} desc)`.as(
          'rank'
        ),
      })
      .from(er)
      .as('ranked');
    const deleted = await fromPromise(
      () =>
        this.db
          .delete(er)
          .where(
            inArray(
              er.id,
              this.db.select({ id: ranked.id }).from(ranked).where(gt(ranked.rank, keep))
            )
          )
          .returning({ id: er.id }),
      databaseUnavailable.during('pruneEntityRevisions')
    );
    return map(deleted, (rows) => rows.length);
  }
}
