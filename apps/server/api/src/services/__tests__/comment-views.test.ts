import type { CommentThread, Disclosure } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { toCommentView } from '../comment-views';

const AT = new Date('2026-03-01T12:00:00.000Z');

const THREAD: CommentThread = {
  id: 'c-1',
  videoId: 'v-1',
  authorId: 'u-1',
  parentId: null,
  content: 'hello',
  isPinned: false,
  isEdited: true,
  likeCount: 3,
  heartedAt: null,
  moderationState: 'held',
  moderationDisclosure: 'silent',
  moderationReason: 'spam',
  moderationNote: 'a note',
  moderatedBy: 'moderator-1',
  moderatedAt: AT,
  heldReason: 'blocked_word',
  looksLikeQuestion: true,
  createdAt: AT,
  updatedAt: AT,
  author: { userId: 'u-1', channelId: 'ch-1', handle: 'u1', displayName: 'U1', avatarUrl: null },
  replyCount: 1,
};

const OWNER: UserContext = { id: 'owner-1', role: 'CREATOR' };
const AUTHOR: UserContext = { id: 'u-1', role: 'USER' };
const STRANGER: UserContext = { id: 'u-2', role: 'USER' };
const TEAM_MODERATOR: UserContext = {
  id: 'u-3',
  role: 'USER',
  memberships: { 'ch-owner': { role: 'moderator', ownerId: 'owner-1' } },
};

const PUBLISHED_VIEW = { status: 'published', moderation: null };

describe('apps/server/api/services: comment views', () => {
  it('renders dates as ISO strings and keeps the author under author', () => {
    expect(toCommentView({ ...THREAD, moderationState: 'published' }, 'owner-1', STRANGER)).toEqual(
      {
        id: 'c-1',
        videoId: 'v-1',
        parentId: null,
        content: 'hello',
        isPinned: false,
        isEdited: true,
        likeCount: 3,
        heartedByCreator: false,
        replyCount: 1,
        ...PUBLISHED_VIEW,
        author: {
          userId: 'u-1',
          channelId: 'ch-1',
          handle: 'u1',
          displayName: 'U1',
          avatarUrl: null,
          isCreator: false,
        },
        createdAt: AT.toISOString(),
        updatedAt: AT.toISOString(),
      }
    );
  });

  it('badges the author who owns the video', () => {
    expect(toCommentView(THREAD, 'u-1', null).author.isCreator).toBe(true);
  });

  it('shows the creator heart as a flag, never the instant', () => {
    const hearted = toCommentView({ ...THREAD, heartedAt: AT }, 'owner-1', null);

    expect(hearted).toMatchObject({ heartedByCreator: true });
    expect(hearted).not.toHaveProperty('heartedAt');
  });

  const FULL = {
    status: 'held',
    moderation: {
      state: 'held',
      reason: 'spam',
      disclosure: 'silent',
      heldReason: 'blocked_word',
      by: 'moderator-1',
      at: AT.toISOString(),
    },
  };

  it.each<{ scenario: string; viewer: UserContext | null; disclosure: Disclosure; seen: object }>([
    { scenario: 'the owner, silent', viewer: OWNER, disclosure: 'silent', seen: FULL },
    {
      scenario: 'a team moderator, visible',
      viewer: TEAM_MODERATOR,
      disclosure: 'visible',
      seen: { ...FULL, moderation: { ...FULL.moderation, disclosure: 'visible' } },
    },
    { scenario: 'the author, silent', viewer: AUTHOR, disclosure: 'silent', seen: PUBLISHED_VIEW },
    {
      scenario: 'the author, visible',
      viewer: AUTHOR,
      disclosure: 'visible',
      seen: { status: 'held', moderation: { state: 'held', reason: 'spam' } },
    },
    {
      scenario: 'a stranger, visible',
      viewer: STRANGER,
      disclosure: 'visible',
      seen: PUBLISHED_VIEW,
    },
    { scenario: 'nobody signed in', viewer: null, disclosure: 'visible', seen: PUBLISHED_VIEW },
  ])('shows a held comment to $scenario', ({ viewer, disclosure, seen }) => {
    const view = toCommentView({ ...THREAD, moderationDisclosure: disclosure }, 'owner-1', viewer);

    expect(view).toMatchObject(seen);
  });

  it('tells the author of a visibly hidden comment its state and nothing of who did it', () => {
    const view = toCommentView(
      { ...THREAD, moderationState: 'hidden', moderationDisclosure: 'visible' },
      'owner-1',
      AUTHOR
    );

    expect(view.moderation).toEqual({ state: 'hidden', reason: 'spam' });
  });
});
