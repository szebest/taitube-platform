import type {
  CommentLocator,
  CommentModerationRepositoryPort,
  CommentModerationWrite,
  CommentModerationWritten,
  CommentRemovalQuery,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { CommentRemoval } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, desc, eq, gte, lt, or } from 'drizzle-orm';
import { drizzleWhere, keysetBefore, notDeletedScope } from '../scopes/index';
import { moderateComment } from './comment-moderation-writes';
import type { PostgresDatabase } from './types';

const { commentRemovals: r, videoComments: c, videos: v } = schema;

export class PostgresCommentModerationRepository implements CommentModerationRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async moderate(
    write: CommentModerationWrite
  ): Promise<Result<CommentModerationWritten, DatabaseUnavailable>> {
    return await fromPromise(
      () => this.db.transaction((tx) => moderateComment(tx, write)),
      databaseUnavailable.during('moderateComment')
    );
  }

  async threadIds(target: CommentLocator): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ id: c.id })
          .from(c)
          .where(
            drizzleWhere(
              eq(c.videoId, target.videoId),
              or(eq(c.id, target.id), eq(c.parentId, target.id)),
              notDeletedScope(c)
            )
          ),
      databaseUnavailable.during('listThreadIds')
    );
    return map(rows, (found) => found.map(({ id }) => id));
  }

  async idsByAuthor(
    authorId: string,
    videoOwnerId: string
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ id: c.id })
          .from(c)
          .innerJoin(v, eq(v.id, c.videoId))
          .where(
            drizzleWhere(eq(c.authorId, authorId), eq(v.ownerId, videoOwnerId), notDeletedScope(c))
          ),
      databaseUnavailable.during('listIdsByAuthor')
    );
    return map(rows, (found) => found.map(({ id }) => id));
  }

  async listRemovals(
    authorId: string,
    { since, cursor, limit }: CommentRemovalQuery
  ): Promise<Result<CommentRemoval[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(r)
          .where(
            and(
              eq(r.authorId, authorId),
              eq(r.disclosure, 'visible'),
              gte(r.createdAt, since),
              keysetBefore(r.createdAt, r.id, cursor && { sort: cursor.createdAt, tie: cursor.id })
            )
          )
          .orderBy(desc(r.createdAt), desc(r.id))
          .limit(limit + 1),
      databaseUnavailable.during('listCommentRemovals')
    );
    return map(rows, (found) => found as CommentRemoval[]);
  }

  async purgeRemovalsBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.delete(r).where(lt(r.createdAt, cutoff)).returning({ id: r.id }),
      databaseUnavailable.during('purgeCommentRemovals')
    );
    return map(rows, (purged) => purged.length);
  }
}
