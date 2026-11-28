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
      mentions: ['exists', 'channel_user_restrictions', '"comments"."channel_id"'],
      params: [],
    },
  ])('narrows to $filter with a subquery', ({ filter, mentions, params: expected }) => {
    const scope = creatorInboxFilterScope(filter, 'owner-1');

    const { sql, params } = dialect.sqlToQuery(scope ?? (undefined as never));

    for (const part of mentions) expect(sql).toContain(part);
    expect(params).toEqual(expected);
  });

  it.each([
    {
      type: 'video' as const,
      video: { id: 'v-1', title: 'Clip' },
    },
    { type: 'post' as const, video: null },
    { type: 'thread' as const, video: { id: 'v-9', title: 'On video' }, threadVideo: true },
  ])(
    'names a $type target and keeps the title out of the comment',
    ({ type, video, threadVideo }) => {
      const at = new Date('2026-03-01T12:00:00.000Z');
      const row = {
        id: 'c-1',
        targetType: type,
        targetId: 'v-1',
        channelId: 'ch-owner',
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
        targetTitle: 'Clip',
        threadVideoId: threadVideo ? 'v-9' : null,
        threadVideoTitle: threadVideo ? 'On video' : null,
      };

      const comment = toCreatorInboxComment(row);

      expect(comment.video).toEqual(video);
      expect(comment.targetSummary).toEqual({ type, id: 'v-1', title: 'Clip' });
      expect(comment).not.toHaveProperty('targetTitle');
      expect(comment).not.toHaveProperty('deletedAt');
    }
  );
});
