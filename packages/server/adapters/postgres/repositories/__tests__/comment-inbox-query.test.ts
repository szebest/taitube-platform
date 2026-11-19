import type { CommentThread } from '@vp/domain';
import { PgDialect } from 'drizzle-orm/pg-core';
import { creatorInboxFilterScope, toCreatorInboxComment } from '../comment-inbox-query';
import { UNMODERATED } from './comment-row';

const dialect = new PgDialect();

describe('comment inbox query', () => {
  it('adds no condition for the whole inbox', () => {
    expect(creatorInboxFilterScope('all', 'owner-1')).toBeUndefined();
  });

  it.each([
    {
      filter: 'unanswered' as const,
      mentions: ['not exists', 'answer.author_id'],
      params: ['owner-1'],
    },
    { filter: 'reported' as const, mentions: ['exists', 'comment_reports'], params: [] },
    {
      filter: 'restricted' as const,
      mentions: ['exists', 'channel_user_restrictions', '"videos"."channel_id"'],
      params: [],
    },
  ])('narrows to $filter with a subquery', ({ filter, mentions, params: expected }) => {
    const scope = creatorInboxFilterScope(filter, 'owner-1');

    const { sql, params } = dialect.sqlToQuery(scope ?? (undefined as never));

    for (const part of mentions) expect(sql).toContain(part);
    expect(params).toEqual(expected);
  });

  it('keeps the video title out of the comment and puts it under video', () => {
    const at = new Date('2026-03-01T12:00:00.000Z');
    const row = {
      id: 'c-1',
      videoId: 'v-1',
      authorId: 'u-1',
      authorChannelId: 'ch-1',
      parentId: null,
      content: 'hi',
      isPinned: false,
      isEdited: false,
      likeCount: 0,
      heartedAt: null,
      createdAt: at,
      updatedAt: at,
      deletedAt: null,
      ...UNMODERATED,
      handle: null,
      displayName: null,
      avatarUrl: null,
      replyCount: 0,
      videoTitle: 'Clip',
    };

    const comment: CommentThread & { video: { id: string; title: string } } =
      toCreatorInboxComment(row);

    expect(comment.video).toEqual({ id: 'v-1', title: 'Clip' });
    expect(comment).not.toHaveProperty('videoTitle');
    expect(comment).not.toHaveProperty('deletedAt');
  });
});
