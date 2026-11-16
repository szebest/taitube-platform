import type { CommentModerationAction } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { applyModeration } from '../apply-moderation.rule';

type Disclosure = 'silent' | 'visible';

const withDisclosure = (
  action: 'hold' | 'hide' | 'remove',
  disclosure: Disclosure,
  reason?: 'spam'
): CommentModerationAction => ({ action, disclosure, ...(reason ? { reason } : {}) });

describe('@vp/domain-rules: applyModeration', () => {
  it.each([
    ['published', 'hold', true, 'held'],
    ['published', 'hold', false, 'held'],
    ['published', 'approve', true, 'refuse:state'],
    ['published', 'approve', false, 'refuse:state'],
    ['published', 'hide', true, 'hidden'],
    ['published', 'hide', false, 'refuse:reason_required'],
    ['published', 'unhide', true, 'refuse:state'],
    ['published', 'unhide', false, 'refuse:state'],
    ['published', 'remove', true, 'removed'],
    ['published', 'remove', false, 'refuse:reason_required'],
    ['held', 'hold', true, 'refuse:state'],
    ['held', 'hold', false, 'refuse:state'],
    ['held', 'approve', true, 'published'],
    ['held', 'approve', false, 'published'],
    ['held', 'hide', true, 'refuse:state'],
    ['held', 'hide', false, 'refuse:state'],
    ['held', 'unhide', true, 'refuse:state'],
    ['held', 'unhide', false, 'refuse:state'],
    ['held', 'remove', true, 'removed'],
    ['held', 'remove', false, 'refuse:reason_required'],
    ['hidden', 'hold', true, 'refuse:state'],
    ['hidden', 'hold', false, 'refuse:state'],
    ['hidden', 'approve', true, 'refuse:state'],
    ['hidden', 'approve', false, 'refuse:state'],
    ['hidden', 'hide', true, 'refuse:state'],
    ['hidden', 'hide', false, 'refuse:state'],
    ['hidden', 'unhide', true, 'published'],
    ['hidden', 'unhide', false, 'published'],
    ['hidden', 'remove', true, 'removed'],
    ['hidden', 'remove', false, 'refuse:reason_required'],
  ] as const)(
    'a %s comment, action %s, reason given %s: %s',
    (from, action, reasonGiven, expected) => {
      const given: CommentModerationAction =
        action === 'approve' || action === 'unhide'
          ? { action }
          : withDisclosure(action, 'visible', reasonGiven ? 'spam' : undefined);

      const result = applyModeration(from, given);

      if (expected.startsWith('refuse:')) {
        expect(isErr(result) && result.error).toMatchObject({
          code: ErrorCodes.MODERATION_NOT_APPLICABLE,
          action,
          state: from,
          why: expected.slice('refuse:'.length),
        });
      } else {
        expect(isOk(result) && result.value.state).toBe(expected);
      }
    }
  );

  it.each([
    {
      scenario: 'a silent hide',
      given: withDisclosure('hide', 'silent'),
      from: 'published' as const,
    },
    {
      scenario: 'a silent remove',
      given: withDisclosure('remove', 'silent'),
      from: 'held' as const,
    },
    {
      scenario: 'a visible hold',
      given: withDisclosure('hold', 'visible'),
      from: 'published' as const,
    },
  ])('needs no reason for $scenario', ({ given, from }) => {
    expect(isOk(applyModeration(from, given))).toBe(true);
  });

  it.each([
    {
      scenario: 'a hold',
      given: { action: 'hold', disclosure: 'visible', reason: 'spam', note: 'n' } as const,
    },
    {
      scenario: 'a hide',
      given: { action: 'hide', disclosure: 'silent', reason: 'hate', note: 'n' } as const,
    },
  ])('carries the disclosure, reason and note of $scenario', ({ given }) => {
    const result = applyModeration('published', given);

    expect(isOk(result) && result.value).toMatchObject({
      disclosure: given.disclosure,
      reason: given.reason,
      note: 'n',
    });
  });

  it.each([
    { action: 'approve' as const, from: 'held' as const },
    { action: 'unhide' as const, from: 'hidden' as const },
  ])('clears the moderation record on $action', ({ action, from }) => {
    const result = applyModeration(from, { action });

    expect(isOk(result) && result.value).toEqual({
      state: 'published',
      disclosure: null,
      reason: null,
      note: null,
    });
  });
});
