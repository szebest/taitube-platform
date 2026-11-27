import { expectOk } from '@kit/testing/result';
import type { CreatorInboxFilter, NewCommentModeration } from '@vp/domain';
import {
  C,
  type CommentContractContext,
  creatorInbox,
  seedComment,
} from './comment-contract-context';
import {
  HOUR_MS,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  OWNER_ID,
  VIDEO_IDS,
  idsOf,
  seededChannel,
  videoTarget,
} from './fixtures';

export function describeCommentInboxFiltersContract(ctx: CommentContractContext): void {
  describe('the moderation filters', () => {
    const state = (moderationState: 'held' | 'hidden', looksLikeQuestion = false) =>
      ({
        moderationState,
        moderationDisclosure: 'silent',
        heldReason: null,
        looksLikeQuestion,
      }) satisfies NewCommentModeration;

    beforeEach(async () => {
      await seedComment(ctx, C.old, { hoursAgo: 4 });
      await seedComment(ctx, C.liked, { hoursAgo: 3, moderation: state('held') });
      await seedComment(ctx, C.fresh, { hoursAgo: 2, moderation: state('hidden') });
      await seedComment(ctx, C.reply1, {
        hoursAgo: 1,
        moderation: {
          moderationState: 'published',
          moderationDisclosure: null,
          heldReason: null,
          looksLikeQuestion: true,
        },
      });
    });

    it.each<{ filter: CreatorInboxFilter; ids: string[] }>([
      { filter: 'held', ids: [C.liked] },
      { filter: 'hidden', ids: [C.fresh] },
      { filter: 'questions', ids: [C.reply1] },
      { filter: 'all', ids: [C.reply1, C.fresh, C.liked, C.old] },
    ])('lists under $filter exactly $ids', async ({ filter, ids }) => {
      expect(idsOf(await creatorInbox(ctx, filter))).toEqual(ids);
    });
  });

  describe('the restricted filter', () => {
    it.each([
      { scenario: 'a shadow ban', kind: 'shadow', hours: undefined, listed: true },
      { scenario: 'a ban without an end', kind: 'ban', hours: undefined, listed: true },
      { scenario: 'a ban that has not ended', kind: 'ban', hours: 1, listed: true },
      { scenario: 'a ban that has ended', kind: 'ban', hours: -1, listed: false },
    ] as const)('lists the comments of an author with $scenario: $listed', async (given) => {
      const channel = await seededChannel(ctx.subject.repositories, OWNER_ID);
      await seedComment(ctx, C.old);
      expectOk(
        await ctx.subject.repositories.channelUserRestrictions.apply({
          channelId: channel.id,
          userId: ctx.authorId,
          kind: given.kind,
          reason: null,
          expiresAt:
            given.hours === undefined ? null : new Date(Date.now() + given.hours * HOUR_MS),
          createdBy: OWNER_ID,
        })
      );

      expect(idsOf(await creatorInbox(ctx, 'restricted'))).toEqual(given.listed ? [C.old] : []);
    });
  });

  describe('announcing a new comment', () => {
    const events = async () =>
      expectOk(await ctx.subject.repositories.userEvents.listFrom(OWNER_ID, 1, 10));

    it('tells the video owner, once per comment by someone else', async () => {
      await seedComment(ctx, C.old);

      const [event, ...rest] = await events();

      expect(rest).toEqual([]);
      expect(event).toMatchObject({
        type: 'comment.created',
        payload: {
          comment: { id: C.old, parentId: null, author: { userId: OTHER_OWNER_ID } },
          video: { id: VIDEO_IDS.a, title: 'Video a' },
        },
      });
    });

    it('does not tell the owner about their own comment', async () => {
      expectOk(
        await ctx.comments.create({
          id: C.old,
          target: videoTarget(VIDEO_IDS.a),
          channelId: OWNER_CHANNEL_ID,
          authorId: OWNER_ID,
          authorChannelId: OWNER_CHANNEL_ID,
          parentId: null,
          content: 'mine',
        })
      );

      expect(await events()).toEqual([]);
    });
  });
}
