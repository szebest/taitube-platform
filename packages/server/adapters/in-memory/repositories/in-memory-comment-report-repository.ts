import type {
  CommentReportQueueCursor,
  CommentReportRepositoryPort,
  ListCommentReportsOptions,
} from '@vp/core/repositories';
import type {
  CommentReport,
  CommentReportQueueItem,
  CommentReportResolution,
  NewCommentReportInput,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Result, ok } from '@vp/result';

export interface CommentLookup {
  peek(
    id: string
  ):
    | { id: string; videoId: string; authorId: string; content: string; removed: boolean }
    | undefined;
}

export interface InMemoryCommentReportRepositoryOptions {
  commentsRepo: CommentLookup;
}

function queueKey(row: { resolvedAt: Date | null; createdAt: Date; id: string }) {
  return [row.resolvedAt === null ? 1 : 0, row.createdAt.getTime(), row.id] as const;
}

function compare(a: ReturnType<typeof queueKey>, b: ReturnType<typeof queueKey>): number {
  for (const [i, left] of a.entries()) {
    const right = b[i] ?? 0;
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}

function cursorKey({ open, createdAt, id }: CommentReportQueueCursor) {
  return queueKey({ resolvedAt: open ? null : createdAt, createdAt, id });
}

export class InMemoryCommentReportRepository implements CommentReportRepositoryPort {
  private readonly reports = new Map<string, CommentReport>();
  private readonly commentsRepo: CommentLookup;

  constructor(options: InMemoryCommentReportRepositoryOptions) {
    this.commentsRepo = options.commentsRepo;
  }

  async create(
    input: NewCommentReportInput
  ): Promise<Result<CommentReport | null, DatabaseUnavailable>> {
    const duplicate = this.all().some(
      (report) => report.commentId === input.commentId && report.reporterId === input.reporterId
    );
    if (duplicate) return ok(null);

    const report: CommentReport = {
      ...input,
      createdAt: new Date(),
      resolvedAt: null,
      resolution: null,
    };
    this.reports.set(report.id, report);
    return ok({ ...report });
  }

  async findById(id: string): Promise<Result<CommentReport | null, DatabaseUnavailable>> {
    const report = this.reports.get(id);
    return ok(report ? { ...report } : null);
  }

  async list({
    cursor,
    limit,
  }: ListCommentReportsOptions): Promise<Result<CommentReportQueueItem[], DatabaseUnavailable>> {
    const after = cursor ? cursorKey(cursor) : null;
    const items: CommentReportQueueItem[] = [];
    for (const report of this.all().sort((a, b) => compare(queueKey(b), queueKey(a)))) {
      const comment = this.commentsRepo.peek(report.commentId);
      if (!comment) continue;
      if (after && compare(queueKey(report), after) >= 0) continue;
      items.push({ ...report, comment });
    }
    return ok(items.slice(0, limit + 1));
  }

  async resolve(
    id: string,
    resolution: CommentReportResolution
  ): Promise<Result<CommentReport | null, DatabaseUnavailable>> {
    const report = this.reports.get(id);
    if (!report || report.resolvedAt !== null) return ok(null);

    Object.assign(report, { resolvedAt: new Date(), resolution });
    return ok({ ...report });
  }

  async resolveForComment(
    commentId: string,
    resolution: CommentReportResolution
  ): Promise<Result<CommentReport[], DatabaseUnavailable>> {
    const open = this.all().filter(
      (report) => report.commentId === commentId && report.resolvedAt === null
    );
    for (const report of open) Object.assign(report, { resolvedAt: new Date(), resolution });
    return ok(open.map((report) => ({ ...report })));
  }

  hasOpenReport(commentId: string): boolean {
    return this.all().some(
      (report) => report.commentId === commentId && report.resolvedAt === null
    );
  }

  clear(): void {
    this.reports.clear();
  }

  private all(): CommentReport[] {
    return Array.from(this.reports.values());
  }
}
