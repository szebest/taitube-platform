import * as schema from '@vp/db';
import { drizzle } from 'drizzle-orm/pglite';
import {
  authoredCommentsQuery,
  creatorInboxQuery,
  toAuthoredComment,
} from '../comment-list-queries';

const AT = new Date('2026-03-01T12:00:00.000Z');
const VIEWER = { id: 'viewer-1', role: 'USER' } as const;

const db = drizzle.mock({ schema });

describe('comment list queries', () => {
  it('lists the caller own live comments, newest first, one row past the page', () => {
    const { sql, params } = authoredCommentsQuery(db, VIEWER, { cursor: null, limit: 24 }).toSQL();

    expect(sql).toContain('"comments"."author_id" = $2');
    expect(sql).toContain('"comments"."deleted_at" IS NULL');
    expect(sql).toContain(
      `order by date_trunc('milliseconds', "comments"."created_at") desc, "comments"."id" desc`
    );
    expect(params).toContain('viewer-1');
    expect(params).toContain(25);
  });

  it('keeps the video title out of the comment and puts it under video', () => {
    const comment = toAuthoredComment({
      id: 'c-1',
      content: 'hi',
      createdAt: AT,
      parentId: null,
      likeCount: 2,
      videoId: 'v-1',
      videoTitle: 'Clip',
    });

    expect(comment).toEqual({
      id: 'c-1',
      content: 'hi',
      createdAt: AT,
      parentId: null,
      likeCount: 2,
      video: { id: 'v-1', title: 'Clip' },
    });
  });

  it('scopes the creator inbox to comments the channel moderates by someone else', () => {
    const { sql } = creatorInboxQuery(db, 'owner-1', {
      channelId: 'channel-1',
      filter: 'all',
      cursor: null,
      limit: 10,
    }).toSQL();

    expect(sql).toContain('"comments"."channel_id" = $5');
    expect(sql).toContain('"comments"."author_id" <> $6');
  });
});
