import type {
  CommentReplyCursor,
  CommentThreadCursor,
  CommentViewer,
  CommentWindow,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { Comment, CommentSort, CommentThread } from '@vp/domain';
import { assertNever } from '@vp/result';
import { type SQL, asc, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { aliasedTable, ownOrPublicScope } from '../scopes/index';
import type { PostgresDatabase } from './types';

const { videoComments: c, channels: ch } = schema;

type CommentRow = typeof c.$inferSelect;

const reply = aliasedTable(c, 'reply');

const replyCountOf = (scope: SQL | undefined) => sql<number>`(
  select count(*)::int from ${reply.from}
  where ${reply.table.videoId} = ${c.videoId} and ${reply.table.parentId} = ${c.id}
    and ${reply.table.deletedAt} is null${scope ? sql` and ${scope}` : sql``}
)`;

const channelColumns = {
  ...getTableColumns(c),
  channelId: ch.id,
  handle: ch.handle,
  displayName: ch.displayName,
  avatarUrl: ch.avatarUrl,
};

/**
 * Selected over `video_comments LEFT JOIN channels ON channels.user_id = author_id`. The reply
 * count is what the viewer may see of the replies, so it matches the thread they open.
 */
const publicThreadColumns = (viewer: CommentViewer) => ({
  ...channelColumns,
  replyCount: replyCountOf(ownOrPublicScope(viewer, reply.table)),
});

/** For the creator and their moderators, who see every reply. */
export const moderatedThreadColumns = { ...channelColumns, replyCount: replyCountOf(undefined) };

type ThreadRow = CommentRow & {
  channelId: string | null;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  replyCount: number;
};

export function toComment({ deletedAt: _deletedAt, ...comment }: CommentRow): Comment {
  return comment;
}

export function toCommentThread({
  channelId,
  handle,
  displayName,
  avatarUrl,
  replyCount,
  ...row
}: ThreadRow): CommentThread {
  const comment = toComment(row);
  const author = { userId: comment.authorId, channelId, handle, displayName, avatarUrl };
  return { ...comment, author, replyCount };
}

interface SortKey<Cursor> {
  column: AnyPgColumn;
  at: (cursor: Cursor) => SQL;
}

const PINNED: SortKey<CommentThreadCursor> = {
  column: c.isPinned,
  at: (k) => sql`${k.isPinned}::boolean`,
};
const LIKES: SortKey<CommentThreadCursor> = {
  column: c.likeCount,
  at: (k) => sql`${k.likeCount}::integer`,
};
const CREATED: SortKey<CommentReplyCursor> = {
  column: c.createdAt,
  at: (k) => sql`${k.createdAt.toISOString()}::timestamptz`,
};
const ID: SortKey<CommentReplyCursor> = { column: c.id, at: (k) => sql`${k.id}::uuid` };

/** Every key descends, so one row comparison resumes the walk down the matching index. */
const THREAD_KEYS: Readonly<Record<CommentSort, readonly SortKey<CommentThreadCursor>[]>> = {
  top: [PINNED, LIKES, CREATED, ID],
  newest: [PINNED, CREATED, ID],
};

const REPLY_KEYS = [CREATED, ID];

function rowCompare<Cursor>(keys: readonly SortKey<Cursor>[], op: '<' | '>', cursor: Cursor) {
  const columns = sql.join(
    keys.map((key) => key.column),
    sql`, `
  );
  const values = sql.join(
    keys.map((key) => key.at(cursor)),
    sql`, `
  );
  return sql`(${columns}) ${sql.raw(op)} (${values})`;
}

export function commentThreadOrderBy(sort: CommentSort): SQL[] {
  return THREAD_KEYS[sort].map((key) => desc(key.column));
}

export function commentThreadCursorScope(
  sort: CommentSort,
  cursor: CommentThreadCursor | null
): SQL | undefined {
  return cursor ? rowCompare(THREAD_KEYS[sort], '<', cursor) : undefined;
}

export function commentReplyOrderBy(): SQL[] {
  return REPLY_KEYS.map((key) => asc(key.column));
}

export function commentReplyCursorScope(cursor: CommentReplyCursor | null): SQL | undefined {
  return cursor ? rowCompare(REPLY_KEYS, '>', cursor) : undefined;
}

export function commentInboxOrderBy(): SQL[] {
  return REPLY_KEYS.map((key) => desc(key.column));
}

export function commentInboxCursorScope(cursor: CommentReplyCursor | null): SQL | undefined {
  return cursor ? rowCompare(REPLY_KEYS, '<', cursor) : undefined;
}

export function commentWindowBounds(window: CommentWindow): {
  cursor: CommentThreadCursor | null;
  offset: number;
} {
  switch (window.type) {
    case 'keyset':
      return { cursor: window.cursor, offset: 0 };
    case 'offset':
      return { cursor: null, offset: window.offset };
    default:
      return assertNever(window, 'CommentWindow');
  }
}

export function selectThreads(db: PostgresDatabase, viewer: CommentViewer) {
  return db
    .select(publicThreadColumns(viewer))
    .from(c)
    .leftJoin(ch, eq(ch.userId, c.authorId))
    .$dynamic();
}

export async function threadById(
  db: PostgresDatabase,
  id: string,
  viewer: CommentViewer
): Promise<CommentThread | null> {
  const [row] = await selectThreads(db, viewer).where(eq(c.id, id));
  return row ? toCommentThread(row) : null;
}
