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

    expect(sql).toContain('"video_comments"."author_id" = $1');
    expect(sql).toContain('"video_comments"."deleted_at" IS NULL');
    expect(sql).toContain(
      'order by "video_comments"."created_at" desc, "video_comments"."id" desc'
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

  it('scopes the creator inbox to comments on the owner videos by someone else', () => {
    const { sql } = creatorInboxQuery(db, 'owner-1', {
      filter: 'all',
      cursor: null,
      limit: 10,
    }).toSQL();

    expect(sql).toContain('"videos"."owner_id" = $1');
    expect(sql).toContain('"video_comments"."author_id" <> $2');
  });
});
