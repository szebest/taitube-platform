import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { EntityRevision, EntityRevisionType, EntitySnapshots } from '@vp/domain';

export interface NewEntityRevision<T extends EntityRevisionType = EntityRevisionType> {
  entityType: T;
  entityId: string;
  version: number;
  snapshot: EntitySnapshots[T];
  authorUserId: string | null;
  restoredFromVersion: number | null;
}

export interface ListRevisionsOptions {
  /** Revisions older than this version only; `null` starts at the newest. */
  beforeVersion: number | null;
  limit: number;
}

/**
 * One history for every entity that keeps one: a new kind adds a type and a snapshot shape, nothing
 * here. A revision is never changed, and a restore appends a new one.
 */
export abstract class EntityRevisionRepository {
  /** A version already recorded for the entity is left as it is. */
  abstract append(revision: NewEntityRevision): Promise<Result<void, DatabaseUnavailable>>;
  /** Newest first, `limit + 1` rows. */
  abstract list(
    entityType: EntityRevisionType,
    entityId: string,
    options: ListRevisionsOptions
  ): Promise<Result<EntityRevision[], DatabaseUnavailable>>;
  /** Scoped to the entity, so a revision id of another one is absent. */
  abstract get(
    entityType: EntityRevisionType,
    entityId: string,
    revisionId: string
  ): Promise<Result<EntityRevision | null, DatabaseUnavailable>>;
  /** Drops all but the newest `keep` revisions of every entity; returns how many went. */
  abstract prune(keep: number): Promise<Result<number, DatabaseUnavailable>>;
}
