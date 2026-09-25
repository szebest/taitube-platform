import type { CommentRepositoryPort } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import {
  C,
  CHANNEL_ID,
  type CommentContractContext,
  commentsCount,
  keyset,
  seedComment,
  seedThreads,
} from './comment-contract-context';
import { describeCommentListingContract } from './comment-listing.contract';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, idsOf, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeCommentRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('CommentRepository contract', () => {
    let subject: RepositoriesSubject;
    let comments: CommentRepositoryPort;
    const ctx: CommentContractContext = {
      get subject() {
        return subject;
      },
      get comments() {
        return comments;
      },
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      comments = subject.repositories.comments;
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.b }));
      await subject.repositories.channels.create({
        id: CHANNEL_ID,
        userId: OTHER_OWNER_ID,
        handle: 'commenter',
        displayName: 'The Commenter',
      });
    });

    it('creates a comment with its author profile and counts it on the video', async () => {
      const created = expectOk(
        await comments.create({
          id: C.old,
          videoId: VIDEO_IDS.a,
          authorId: OTHER_OWNER_ID,
          parentId: null,
          content: 'first',
        })
      );

      expect(created).toMatchObject({
        id: C.old,
        videoId: VIDEO_IDS.a,
        parentId: null,
        content: 'first',
        isPinned: false,
        isEdited: false,
        likeCount: 0,
        replyCount: 0,
        author: {
          userId: OTHER_OWNER_ID,
          channelId: CHANNEL_ID,
          handle: 'commenter',
          displayName: 'The Commenter',
          avatarUrl: null,
        },
      });
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(await commentsCount(ctx, VIDEO_IDS.a)).toBe(1);
    });

    it('leaves the channel fields empty for an author without a channel', async () => {
      const created = expectOk(
        await comments.create({
          id: C.old,
          videoId: VIDEO_IDS.a,
          authorId: OWNER_ID,
          parentId: null,
          content: 'no channel',
        })
      );

      expect(created.author).toEqual({
        userId: OWNER_ID,
        channelId: null,
        handle: null,
        displayName: null,
        avatarUrl: null,
      });
    });

    it('keeps every write to comments_count exact under concurrent creates', async () => {
      const ids = Array.from(
        { length: 10 },
        (_, i) => `00000000-0000-7000-8000-0000000000${10 + i}`
      );

      await Promise.all(
        ids.map((id) =>
          comments.create({
            id,
            videoId: VIDEO_IDS.a,
            authorId: OTHER_OWNER_ID,
            parentId: null,
            content: id,
          })
        )
      );

      expect(await commentsCount(ctx, VIDEO_IDS.a)).toBe(10);
    });

    it('edits the content and marks the comment edited', async () => {
      await seedComment(ctx, C.old);

      const edited = expectOk(await comments.updateContent(C.old, 'rewritten'));

      expect(edited).toMatchObject({ id: C.old, content: 'rewritten', isEdited: true });
      expect(expectOk(await comments.findById(C.old))?.content).toBe('rewritten');
    });

    it('removes a root with its replies and takes them all off the count', async () => {
      await seedThreads(ctx);

      const removed = expectOk(await comments.remove({ id: C.liked, videoId: VIDEO_IDS.a }));

      expect(removed).toBe(3);
      expect(await commentsCount(ctx, VIDEO_IDS.a)).toBe(2);
      expect(expectOk(await comments.findById(C.liked))).toBeNull();
      expect(expectOk(await comments.findById(C.reply1))).toBeNull();
      expect(expectOk(await comments.updateContent(C.liked, 'too late'))).toBeNull();
      expect(
        idsOf(
          expectOk(await comments.listThreads(VIDEO_IDS.a, { sort: 'top', window: keyset(10) }))
        )
      ).toEqual([C.old, C.fresh]);
    });

    it('removes a reply and drops it from its root reply count', async () => {
      await seedThreads(ctx);

      expect(expectOk(await comments.remove({ id: C.reply1, videoId: VIDEO_IDS.a }))).toBe(1);
      expect(expectOk(await comments.remove({ id: C.reply1, videoId: VIDEO_IDS.a }))).toBe(0);

      const [liked] = expectOk(
        await comments.listThreads(VIDEO_IDS.a, { sort: 'top', window: keyset(1) })
      );
      expect(liked).toMatchObject({ id: C.liked, replyCount: 1 });
      expect(await commentsCount(ctx, VIDEO_IDS.a)).toBe(4);
    });

    it('holds one pinned comment per video, unpinning the previous one', async () => {
      await seedThreads(ctx);
      const at = (id: string) => ({ id, videoId: VIDEO_IDS.a });

      expectOk(await comments.setPinned(at(C.old), true));
      const pinned = expectOk(await comments.setPinned(at(C.fresh), true));

      expect(pinned).toMatchObject({ id: C.fresh, isPinned: true });
      expect(expectOk(await comments.findById(C.old))?.isPinned).toBe(false);

      const unpinned = expectOk(await comments.setPinned(at(C.fresh), false));
      expect(unpinned?.isPinned).toBe(false);
    });

    it('answers null when pinning a comment that is gone', async () => {
      expect(
        expectOk(await comments.setPinned({ id: C.old, videoId: VIDEO_IDS.a }, true))
      ).toBeNull();
    });

    describeCommentListingContract(ctx);
  });
}
