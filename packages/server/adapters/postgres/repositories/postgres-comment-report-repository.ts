import { type Result, fromPromise, map } from '@kit/result';
import type {
  CommentReportQueueCursor,
  CommentReportRepositoryPort,
  ListCommentReportsOptions,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type CommentReport,
  type CommentReportQueueItem,
  type CommentReportResolution,
  type NewCommentReportInput,
  commentVideoId,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type SQL, and, desc, eq, isNull, sql } from 'drizzle-orm';
import { msTimestamp } from '../scopes/index';
import { targetOf } from './comment-targets';
import type { PostgresDatabase } from './types';

const { commentReports: r, comments: c } = schema;

const isOpen = sql<boolean>`(${r.resolvedAt} is null)`;
const reportedAt = msTimestamp(r.createdAt);

function queueCursorScope(cursor: CommentReportQueueCursor | null): SQL | undefined {
  if (!cursor) return undefined;
  const { open, createdAt, id } = cursor;
  return sql`(${isOpen}, ${reportedAt}, ${r.id}) < (${open}::boolean, ${createdAt.toISOString()}::timestamptz, ${id}::uuid)`;
}

export class PostgresCommentReportRepository implements CommentReportRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(
    input: NewCommentReportInput
  ): Promise<Result<CommentReport | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .insert(r)
          .values({ ...input, createdAt: new Date() })
          .onConflictDoNothing()
          .returning(),
      databaseUnavailable.during('createCommentReport')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async findById(id: string): Promise<Result<CommentReport | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(r).where(eq(r.id, id)),
      databaseUnavailable.during('findCommentReport')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async list({
    cursor,
    limit,
  }: ListCommentReportsOptions): Promise<Result<CommentReportQueueItem[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({
            report: r,
            comment: {
              id: c.id,
              targetType: c.targetType,
              targetId: c.targetId,
              authorId: c.authorId,
              content: c.content,
              deletedAt: c.deletedAt,
            },
          })
          .from(r)
          .innerJoin(c, eq(c.id, r.commentId))
          .where(queueCursorScope(cursor))
          .orderBy(desc(isOpen), desc(reportedAt), desc(r.id))
          .limit(limit + 1),
      databaseUnavailable.during('listCommentReports')
    );
    return map(rows, (found) =>
      found.map(({ report, comment: { deletedAt, targetType, targetId, ...comment } }) => ({
        ...report,
        comment: {
          ...comment,
          videoId: commentVideoId(targetOf({ targetType, targetId })),
          removed: deletedAt !== null,
        },
      }))
    );
  }

  async resolve(
    id: string,
    resolution: CommentReportResolution
  ): Promise<Result<CommentReport | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(r)
          .set({ resolvedAt: new Date(), resolution })
          .where(and(eq(r.id, id), isNull(r.resolvedAt)))
          .returning(),
      databaseUnavailable.during('resolveCommentReport')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async resolveForComment(
    commentId: string,
    resolution: CommentReportResolution
  ): Promise<Result<CommentReport[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .update(r)
          .set({ resolvedAt: new Date(), resolution })
          .where(and(eq(r.commentId, commentId), isNull(r.resolvedAt)))
          .returning(),
      databaseUnavailable.during('resolveCommentReports')
    );
  }
}
