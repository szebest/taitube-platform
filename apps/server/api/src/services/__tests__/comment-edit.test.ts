import type { CommentSettings } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { expectErr, expectOk } from '@vp/testing/result';
import { decideCommentEdit } from '../comment-edit';
import {
  type CommentCreateHarness,
  OTHER,
  OWNER,
  VIDEO_ID,
  VIEWER,
  setUpCommentCreate,
} from './comment-create-harness';
import { commentCreateDeps } from './comment-deps';

describe('apps/server/api/services: decide a comment edit', () => {
  let h: CommentCreateHarness;

  const decide = async (author: UserContext, content: string, commentId: string) => {
    const comment = expectOk(await h.repositories.comments.findById(commentId));
    const video = expectOk(await h.repositories.videos.findById(VIDEO_ID));
    if (!comment) throw new Error('comment missing');
    return decideCommentEdit(
      commentCreateDeps(h.repositories, h.now),
      author,
      comment,
      video,
      content
    );
  };

  beforeEach(async () => {
    h = await setUpCommentCreate();
    h.setClock(Date.now() + 1000);
  });

  it.each<{
    scenario: string;
    settings: Partial<CommentSettings>;
    content: string;
    reason: string;
    disclosure: string;
  }>([
    {
      scenario: 'a blocked word',
      settings: { blockedWords: ['spoiler'] },
      content: 'now a Spoiler',
      reason: 'blocked_word',
      disclosure: 'silent',
    },
    {
      scenario: 'a link off the allowlist',
      settings: { reviewMode: 'links', linkAllowlist: ['example.com'] },
      content: 'see https://other.dev/x',
      reason: 'link',
      disclosure: 'visible',
    },
    {
      scenario: 'review of everything',
      settings: { reviewMode: 'all' },
      content: 'anything',
      reason: 'review_all',
      disclosure: 'visible',
    },
  ])(
    'holds a published comment edited into $scenario, with that rule disclosure and the moderators to tell',
    async ({ settings, content, reason, disclosure }) => {
      const { id } = expectOk(await h.create(VIEWER));
      await h.configure(settings);

      const edit = expectOk(await decide(VIEWER, content, id));

      expect(edit.hold).toEqual({ reason, disclosure, moderators: [OWNER.id] });
    }
  );

  it('holds nothing for clean words', async () => {
    const { id } = expectOk(await h.create(VIEWER));
    await h.configure({ blockedWords: ['spoiler'], reviewMode: 'links' });

    expect(expectOk(await decide(VIEWER, 'still fine', id)).hold).toBeUndefined();
  });

  it('lets a trusted commenter and a team member edit into anything', async () => {
    const { id } = expectOk(await h.create(VIEWER));
    const mine = expectOk(await h.create(OWNER, 'owner words')).id;
    await h.configure({ reviewMode: 'all', blockedWords: ['spoiler'] });
    expectOk(await h.repositories.trustedCommenters.add(h.channelId, VIEWER.id, OWNER.id));

    expect(expectOk(await decide(VIEWER, 'a spoiler', id)).hold).toBeUndefined();
    expect(expectOk(await decide(OWNER, 'a spoiler', mine)).hold).toBeUndefined();
  });

  it.each(['held', 'hidden'] as const)(
    'leaves a %s comment where its moderator put it',
    async (state) => {
      const { id } = expectOk(await h.create(OTHER));
      const stored = h.repositories.comments.comments.get(id);
      Object.assign(stored ?? {}, { moderationState: state });
      await h.configure({ blockedWords: ['spoiler'] });

      expect(expectOk(await decide(OTHER, 'a spoiler', id)).hold).toBeUndefined();
    }
  );

  it.each([
    { content: 'how does this work?', looksLikeQuestion: true },
    { content: 'it works', looksLikeQuestion: false },
  ])(
    'flags "$content" as a question: $looksLikeQuestion',
    async ({ content, looksLikeQuestion }) => {
      const { id } = expectOk(await h.create(VIEWER));

      expect(expectOk(await decide(VIEWER, content, id)).looksLikeQuestion).toBe(looksLikeQuestion);
    }
  );

  it('refuses an author under a visible ban', async () => {
    const { id } = expectOk(await h.create(VIEWER));
    expectOk(
      await h.repositories.channelUserRestrictions.apply({
        channelId: h.channelId,
        userId: VIEWER.id,
        kind: 'ban',
        reason: 'spam',
        expiresAt: null,
        createdBy: OWNER.id,
      })
    );

    const refused = expectErr(await decide(VIEWER, 'edit', id));

    expect(refused.code).toBe(ErrorCodes.COMMENTS_BANNED);
  });

  it('lets a shadow banned author edit, which keeps it silent', async () => {
    const { id } = expectOk(await h.create(VIEWER));
    expectOk(
      await h.repositories.channelUserRestrictions.apply({
        channelId: h.channelId,
        userId: VIEWER.id,
        kind: 'shadow',
        reason: null,
        expiresAt: null,
        createdBy: OWNER.id,
      })
    );

    expect(expectOk(await decide(VIEWER, 'edit', id)).hold).toBeUndefined();
  });
});
