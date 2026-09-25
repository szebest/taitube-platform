import { sql } from 'drizzle-orm';
import { sqlParams, sqlText } from '../../scopes/__tests__/sql-text';
import {
  commentReplyCursorScope,
  commentReplyOrderBy,
  commentThreadCursorScope,
  commentThreadOrderBy,
  commentWindowBounds,
  toCommentThread,
} from '../comment-thread-query';

const CREATED_AT = new Date('2026-03-01T12:00:00.000Z');
const CURSOR = { isPinned: true, likeCount: 4, createdAt: CREATED_AT, id: 'c-9' };

const col = (name: string) => `"video_comments"."${name}"`;

describe('adapters/postgres: comment thread SQL query', () => {
  it.each([
    {
      sort: 'top' as const,
      order: ['is_pinned', 'like_count', 'created_at', 'id'],
      params: [true, 4, CREATED_AT.toISOString(), 'c-9'],
    },
    {
      sort: 'newest' as const,
      order: ['is_pinned', 'created_at', 'id'],
      params: [true, CREATED_AT.toISOString(), 'c-9'],
    },
  ])('orders and resumes $sort on $order, all descending', ({ sort, order, params }) => {
    const orderBy = sql.join(commentThreadOrderBy(sort), sql`, `);
    const scope = commentThreadCursorScope(sort, CURSOR);

    expect(sqlText(orderBy)).toBe(order.map((name) => `${col(name)} desc`).join(', '));
    expect(sqlText(scope)).toMatch(`(${order.map(col).join(', ')}) < (`);
    expect(sqlParams(scope)).toEqual(params);
  });

  it('casts each cursor value to its column type', () => {
    expect(sqlText(commentThreadCursorScope('top', CURSOR))).toContain(
      '($1::boolean, $2::integer, $3::timestamptz, $4::uuid)'
    );
  });

  it('reads replies oldest first and resumes after the cursor', () => {
    const scope = commentReplyCursorScope({ createdAt: CREATED_AT, id: 'r-1' });

    expect(sqlText(sql.join(commentReplyOrderBy(), sql`, `))).toBe(
      `${col('created_at')} asc, ${col('id')} asc`
    );
    expect(sqlText(scope)).toBe(
      `(${col('created_at')}, ${col('id')}) > ($1::timestamptz, $2::uuid)`
    );
  });

  it.each([
    { scenario: 'the first thread page', scope: commentThreadCursorScope('top', null) },
    { scenario: 'the first reply page', scope: commentReplyCursorScope(null) },
  ])('adds no predicate on $scenario', ({ scope }) => {
    expect(scope).toBeUndefined();
  });

  it.each([
    {
      window: { type: 'keyset' as const, cursor: CURSOR, limit: 5 },
      expected: { cursor: CURSOR, offset: 0 },
    },
    {
      window: { type: 'offset' as const, offset: 40, limit: 20 },
      expected: { cursor: null, offset: 40 },
    },
  ])('bounds a $window.type window', ({ window, expected }) => {
    expect(commentWindowBounds(window)).toEqual(expected);
  });

  it('folds the joined channel into the author and drops the tombstone', () => {
    const thread = toCommentThread({
      id: 'c-1',
      videoId: 'v-1',
      authorId: 'u-1',
      parentId: null,
      content: 'hi',
      isPinned: false,
      isEdited: false,
      likeCount: 0,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      deletedAt: null,
      channelId: null,
      handle: null,
      displayName: null,
      avatarUrl: null,
      replyCount: 2,
    });

    expect(thread).not.toHaveProperty('deletedAt');
    expect(thread.author).toEqual({
      userId: 'u-1',
      channelId: null,
      handle: null,
      displayName: null,
      avatarUrl: null,
    });
    expect(thread.replyCount).toBe(2);
  });
});
