import type { CommentViewer } from '@vp/core/repositories';
import type { ModerationState } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { C, type CommentContractContext, commentsCount, keyset } from './comment-contract-context';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, idsOf } from './fixtures';

const STRANGER_ID = '00000000-0000-7000-8000-000000000f01';
const VIEWERS = {
  anonymous: null,
  stranger: { id: STRANGER_ID },
  author: { id: OTHER_OWNER_ID },
} satisfies Record<string, CommentViewer>;

type ViewerKind = keyof typeof VIEWERS;

const ROOT = { id: C.old, videoId: VIDEO_IDS.a };

export function describeCommentPublicScopeContract(ctx: CommentContractContext): void {
  describe('public scope', () => {
    const shadowBan = async (userId = OTHER_OWNER_ID) => {
      const channel = expectOk(await ctx.subject.repositories.channels.findByUserId(OWNER_ID));
      if (!channel) throw new Error('the video owner has no channel to ban on');
      expectOk(
        await ctx.subject.repositories.channelUserRestrictions.apply({
          channelId: channel.id,
          userId,
          kind: 'shadow',
          reason: null,
          expiresAt: null,
          createdBy: OWNER_ID,
        })
      );
    };
    const lift = async () => {
      const channel = expectOk(await ctx.subject.repositories.channels.findByUserId(OWNER_ID));
      expectOk(
        await ctx.subject.repositories.channelUserRestrictions.lift(
          channel?.id ?? '',
          OTHER_OWNER_ID
        )
      );
    };

    beforeEach(async () => {
      await ctx.subject.repositories.channels.create({
        userId: OWNER_ID,
        handle: 'video-owner',
        displayName: 'Video Owner',
      });
    });

    const write = async (
      id: string,
      options: { authorId?: string; parentId?: string; state?: ModerationState } = {}
    ) => {
      const created = expectOk(
        await ctx.comments.create({
          id,
          videoId: VIDEO_IDS.a,
          authorId: options.authorId ?? OTHER_OWNER_ID,
          parentId: options.parentId ?? null,
          content: `comment ${id.slice(-2)}`,
          moderation: {
            moderationState: options.state ?? 'published',
            moderationDisclosure: null,
            heldReason: null,
            looksLikeQuestion: false,
          },
        })
      );
      if (!created) throw new Error(`comment ${id} was not written`);
      return created;
    };
    const roots = async (viewer: CommentViewer) =>
      idsOf(
        expectOk(
          await ctx.comments.listThreads(VIDEO_IDS.a, {
            viewer,
            sort: 'newest',
            window: keyset(10),
          })
        )
      );
    const visible = async (viewer: CommentViewer, id: string) =>
      expectOk(await ctx.comments.findVisible(viewer, id)) !== null;

    it.each(
      (['published', 'held', 'hidden'] as const).flatMap((state) =>
        (Object.keys(VIEWERS) as ViewerKind[]).map((viewer) => ({
          state,
          viewer,
          shown: state === 'published' || viewer === 'author',
        }))
      )
    )('shows a $state comment to $viewer: $shown', async ({ state, viewer, shown }) => {
      await write(C.old, { state });

      expect(await roots(VIEWERS[viewer])).toEqual(shown ? [C.old] : []);
      expect(await visible(VIEWERS[viewer], C.old)).toBe(shown);
    });

    it.each([
      { viewer: 'anonymous' as const, shown: [] },
      { viewer: 'stranger' as const, shown: [] },
      { viewer: 'author' as const, shown: [C.reply1] },
    ])(
      'takes the replies of a hidden root out of the thread for $viewer',
      async ({ viewer, shown }) => {
        await write(C.old, { state: 'hidden' });
        await write(C.reply1, { parentId: C.old, authorId: OTHER_OWNER_ID });

        const replies = expectOk(
          await ctx.comments.listReplies(ROOT, { viewer: VIEWERS[viewer], cursor: null, limit: 10 })
        );

        expect(idsOf(replies)).toEqual(shown);
        expect(await visible(VIEWERS[viewer], C.reply1)).toBe(shown.length > 0);
      }
    );

    it.each([
      { viewer: 'anonymous' as const, replyCount: 1 },
      { viewer: 'stranger' as const, replyCount: 1 },
      { viewer: 'author' as const, replyCount: 3 },
    ])('counts the replies $viewer may see: $replyCount', async ({ viewer, replyCount }) => {
      await write(C.old, { authorId: OWNER_ID });
      await write(C.reply1, { parentId: C.old });
      await write(C.reply2, { parentId: C.old, state: 'held' });
      await write(C.other, { parentId: C.old, state: 'hidden' });

      const [thread] = expectOk(
        await ctx.comments.listThreads(VIDEO_IDS.a, {
          viewer: VIEWERS[viewer],
          sort: 'newest',
          window: keyset(10),
        })
      );

      expect(thread?.replyCount).toBe(replyCount);
    });

    it.each([
      { viewer: 'anonymous' as const, shown: false },
      { viewer: 'stranger' as const, shown: false },
      { viewer: 'author' as const, shown: true },
    ])(
      'shows a shadow banned author only to themselves ($viewer: $shown), and everyone again once lifted',
      async ({ viewer, shown }) => {
        await write(C.old);
        await shadowBan();

        expect(await roots(VIEWERS[viewer])).toEqual(shown ? [C.old] : []);
        expect(await visible(VIEWERS[viewer], C.old)).toBe(shown);

        await lift();
        expect(await roots(VIEWERS[viewer])).toEqual([C.old]);
      }
    );

    it('accepts a shadow banned author comment and answers it like any other', async () => {
      await shadowBan();

      const created = await write(C.old);

      expect(created).toMatchObject({ id: C.old, moderationState: 'published', replyCount: 0 });
    });

    it('answers the author thread with the replies they may see', async () => {
      await write(C.old);
      await write(C.reply1, { parentId: C.old, state: 'held' });

      const [thread] = expectOk(
        await ctx.comments.listThreads(VIDEO_IDS.a, {
          viewer: VIEWERS.author,
          sort: 'newest',
          window: keyset(10),
        })
      );

      expect(thread?.replyCount).toBe(1);
    });

    it('stores what the gate decided with the comment', async () => {
      const created = expectOk(
        await ctx.comments.create({
          id: C.old,
          videoId: VIDEO_IDS.a,
          authorId: OTHER_OWNER_ID,
          parentId: null,
          content: 'is this a question?',
          moderation: {
            moderationState: 'held',
            moderationDisclosure: 'visible',
            heldReason: 'blocked_word',
            looksLikeQuestion: true,
          },
        })
      );

      expect(created).toMatchObject({
        moderationState: 'held',
        moderationDisclosure: 'visible',
        heldReason: 'blocked_word',
        looksLikeQuestion: true,
      });
      expect(expectOk(await ctx.comments.findById(C.old))).toMatchObject({
        moderationState: 'held',
        heldReason: 'blocked_word',
      });
    });

    it.each([
      { name: 'a held comment', state: 'held' as const, banned: false },
      { name: 'a comment of a shadow banned author', state: 'published' as const, banned: true },
    ])('tells the video owner nothing about $name', async ({ state, banned }) => {
      if (banned) await shadowBan();

      await write(C.old, { state });

      expect(expectOk(await ctx.subject.repositories.userEvents.listFrom(OWNER_ID, 1, 10))).toEqual(
        []
      );
    });

    describe('comments_count', () => {
      it.each([
        { name: 'a published comment', state: 'published' as const, banned: false, counted: 1 },
        { name: 'a held comment', state: 'held' as const, banned: false, counted: 0 },
        { name: 'a hidden comment', state: 'hidden' as const, banned: false, counted: 0 },
        {
          name: 'a comment of a shadow banned author',
          state: 'published' as const,
          banned: true,
          counted: 0,
        },
      ])('adds $counted for $name', async ({ state, banned, counted }) => {
        if (banned) await shadowBan();

        await write(C.old, { state });

        expect(await commentsCount(ctx, VIDEO_IDS.a)).toBe(counted);
      });

      it('takes off only what was counted when a root is removed with its replies', async () => {
        await write(C.old);
        await write(C.reply1, { parentId: C.old });
        await write(C.reply2, { parentId: C.old, state: 'held' });
        expect(await commentsCount(ctx, VIDEO_IDS.a)).toBe(2);

        expectOk(await ctx.comments.remove(ROOT));

        expect(await commentsCount(ctx, VIDEO_IDS.a)).toBe(0);
      });

      it('leaves the count alone when a held comment is removed', async () => {
        await write(C.old);
        await write(C.reply1, { state: 'held' });

        expectOk(await ctx.comments.remove({ id: C.reply1, videoId: VIDEO_IDS.a }));

        expect(await commentsCount(ctx, VIDEO_IDS.a)).toBe(1);
      });
    });
  });
}
