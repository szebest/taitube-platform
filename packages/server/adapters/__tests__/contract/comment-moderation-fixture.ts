import type { CommentModerationWrite } from '@vp/core/repositories';
import {
  type CommentModerationAction,
  type Disclosure,
  type ModerationState,
  commentModerationAudit,
} from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { type CommentContractContext, commentsCount } from './comment-contract-context';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export const outcome = (
  state: ModerationState,
  disclosure: Disclosure | null = null,
  reason: 'spam' | null = null
) => ({ state, disclosure, reason, note: null });

export const HELD_AT_CREATION = {
  moderationState: 'held',
  moderationDisclosure: 'visible',
  heldReason: 'review_all',
  looksLikeQuestion: false,
} as const;

export interface ModerationFixture {
  readonly ctx: CommentContractContext;
  readonly channelId: string;
  target(id: string): { id: string; videoId: string };
  audit(
    action: CommentModerationAction['action'],
    id: string,
    disclosure: Disclosure
  ): ReturnType<typeof commentModerationAudit>;
  moderate(
    id: string,
    action: CommentModerationAction['action'],
    from: ModerationState,
    to: ReturnType<typeof outcome> & { state: ModerationState }
  ): Promise<ReturnType<typeof expectOk>>;
  removal(
    id: string,
    disclosure: Disclosure
  ): {
    id: string;
    channelId: string;
    videoId: string;
    authorId: string;
    excerpt: string;
    reason: 'spam';
    note: null;
    disclosure: Disclosure;
    removedBy: string;
  };
  count(): Promise<number | undefined>;
  auditedActions(): Promise<string[]>;
}

/** A video owned by `OWNER_ID` with a channel, and comments written by `OTHER_OWNER_ID`. */
export function describeModerationFixture(
  title: string,
  makeSubject: MakeRepositoriesSubject,
  body: (fixture: ModerationFixture) => void
): void {
  describe(title, () => {
    let subject: RepositoriesSubject;
    let channelId: string;
    const ctx: CommentContractContext = {
      get subject() {
        return subject;
      },
      get comments() {
        return subject.repositories.comments;
      },
      authorId: OTHER_OWNER_ID,
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
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.channels.create({
        userId: OTHER_OWNER_ID,
        handle: 'commenter',
        displayName: 'The Commenter',
      });
      const channel = expectOk(
        await subject.repositories.channels.create({
          userId: OWNER_ID,
          handle: 'video-owner',
          displayName: 'Video Owner',
        })
      );
      channelId = channel.id;
    });

    const audit: ModerationFixture['audit'] = (action, id, disclosure) =>
      commentModerationAudit({
        channelId,
        actorUserId: OWNER_ID,
        action,
        commentId: id,
        videoId: VIDEO_IDS.a,
        disclosure,
      });

    body({
      ctx,
      get channelId() {
        return channelId;
      },
      target: (id) => ({ id, videoId: VIDEO_IDS.a }),
      audit,
      moderate: async (id, action, from, to) =>
        expectOk(
          await subject.repositories.commentModeration.moderate({
            comment: { id, videoId: VIDEO_IDS.a },
            from,
            outcome: to,
            moderatorId: OWNER_ID,
            audit: audit(action, id, to.disclosure ?? 'silent'),
          } satisfies CommentModerationWrite)
        ),
      removal: (id, disclosure) => ({
        id,
        channelId,
        videoId: VIDEO_IDS.a,
        authorId: ctx.authorId,
        excerpt: 'excerpt',
        reason: 'spam',
        note: null,
        disclosure,
        removedBy: OWNER_ID,
      }),
      count: () => commentsCount(ctx, VIDEO_IDS.a),
      auditedActions: async () =>
        expectOk(
          await subject.repositories.channelAudit.list(channelId, { cursor: null, limit: 20 })
        )
          .map((entry) => entry.action)
          .reverse(),
    });
  });
}
