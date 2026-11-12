import { ErrorCodes } from '@vp/errors';
import { expectErr, expectOk } from '@vp/testing/result';
import { updateComment } from '../comment-update';
import {
  type CommentCreateHarness,
  MISSING_ID,
  OTHER,
  OWNER,
  VIDEO_ID,
  VIEWER,
  setUpCommentCreate,
} from './comment-create-harness';
import { commentUpdateDeps } from './comment-deps';

describe('apps/server/api/services: update comment', () => {
  let h: CommentCreateHarness;
  let rootId: string;
  let replyId: string;

  const update = (content: string, author = VIEWER, id = rootId) =>
    updateComment(commentUpdateDeps(h.repositories, h.now), author, id, content);
  const total = async () => expectOk(await h.repositories.videos.findById(VIDEO_ID))?.commentsCount;
  const stateOf = async (id: string) =>
    expectOk(await h.repositories.comments.findById(id))?.moderationState;

  beforeEach(async () => {
    h = await setUpCommentCreate();
    rootId = expectOk(await h.create(VIEWER, 'hello')).id;
    replyId = expectOk(await h.create(OTHER, 'a reply', rootId)).id;
  });

  it('rewrites a clean edit in place and changes no count', async () => {
    await h.configure({ blockedWords: ['spoiler'] });

    const { thread } = expectOk(await update('how does it end?'));

    expect(thread).toMatchObject({
      content: 'how does it end?',
      isEdited: true,
      looksLikeQuestion: true,
      moderationState: 'published',
    });
    expect(await total()).toBe(2);
  });

  it('holds an edit into a blocked word, takes the comment and its replies off the count and keeps the reply published', async () => {
    await h.configure({ blockedWords: ['spoiler'] });

    const { thread } = expectOk(await update('a spoiler'));

    expect(thread).toMatchObject({
      moderationState: 'held',
      moderationDisclosure: 'silent',
      heldReason: 'blocked_word',
    });
    expect(await total()).toBe(0);
    expect(await stateOf(replyId)).toBe('published');
  });

  it('tells the owner a comment is held, and never the author', async () => {
    await h.configure({ reviewMode: 'all' });

    expectOk(await update('anything'));

    const told = async (userId: string) =>
      expectOk(await h.repositories.userEvents.listFrom(userId, 0, 10)).map(({ type }) => type);
    expect(await told(OWNER.id)).toContain('comment.held');
    expect(await told(VIEWER.id)).toEqual([]);
  });

  it('takes back the unread notification of the comment it holds', async () => {
    expectOk(
      await h.repositories.notifications.record({
        userId: OWNER.id,
        kind: 'comment',
        actorChannelId: null,
        videoId: VIDEO_ID,
        commentId: rootId,
        groupKey: null,
        payload: { actor: null, videoTitle: 'Open', excerpt: 'hello', outcome: null },
      })
    );
    await h.configure({ blockedWords: ['spoiler'] });

    expectOk(await update('a spoiler'));

    expect(expectOk(await h.repositories.notifications.unreadCount(OWNER.id))).toBe(0);
  });

  it('refuses a visibly banned author and writes nothing', async () => {
    expectOk(
      await h.repositories.channelUserRestrictions.apply({
        channelId: h.channelId,
        userId: VIEWER.id,
        kind: 'ban',
        reason: null,
        expiresAt: null,
        createdBy: OWNER.id,
      })
    );

    const refused = expectErr(await update('edited'));

    expect(refused.code).toBe(ErrorCodes.COMMENTS_BANNED);
    expect(expectOk(await h.repositories.comments.findById(rootId))?.content).toBe('hello');
  });

  it.each([
    { scenario: 'another account', author: OTHER, id: undefined, code: ErrorCodes.FORBIDDEN },
    {
      scenario: 'a missing comment',
      author: VIEWER,
      id: MISSING_ID,
      code: ErrorCodes.COMMENT_NOT_FOUND,
    },
  ])('refuses $scenario', async ({ author, id, code }) => {
    expect(expectErr(await update('edited', author, id)).code).toBe(code);
  });
});
