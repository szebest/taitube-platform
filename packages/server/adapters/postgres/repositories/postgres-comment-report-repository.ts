import type {
  CommentReportQueueCursor,
  CommentReportRepositoryPort,
  ListCommentReportsOptions,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type {
  CommentReport,
  CommentReportQueueItem,
  CommentReportResolution,
  NewCommentReportInput,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, desc, eq, isNull, type SQL, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { commentReports: r, videoComments: c } = schema;

const isOpen = sql<boolean>`(${r.resolvedAt} is null)`;

function queueCursorScope(cursor: CommentReportQueueCursor | null): SQL | undefined {
  if (!cursor) return undefined;
  const { open, createdAt, id } = cursor;
  return sql`(${isOpen}, ${r.createdAt}, ${r.id}) < (${open}::boolean, ${createdAt.toISOString()}::timestamptz, ${id}::uuid)`;
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
              videoId: c.videoId,
              authorId: c.authorId,
              content: c.content,
              deletedAt: c.deletedAt,
            },
          })
          .from(r)
          .innerJoin(c, eq(c.id, r.commentId))
          .where(queueCursorScope(cursor))
          .orderBy(desc(isOpen), desc(r.createdAt), desc(r.id))
          .limit(limit + 1),
      databaseUnavailable.during('listCommentReports')
    );
    return map(rows, (found) =>
      found.map(({ report, comment: { deletedAt, ...comment } }) => ({
        ...report,
        comment: { ...comment, removed: deletedAt !== null },
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
