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
    { action: 'hold', from: 'published', next: 'held' },
    { action: 'approve', from: 'held', next: 'published' },
    { action: 'hide', from: 'published', next: 'hidden' },
    { action: 'unhide', from: 'hidden', next: 'published' },
    { action: 'remove', from: 'published', next: 'removed' },
    { action: 'remove', from: 'held', next: 'removed' },
    { action: 'remove', from: 'hidden', next: 'removed' },
  ] as const)(
    'moves $from to $next on $action, for either disclosure',
    ({ action, from, next }) => {
      const actions: CommentModerationAction[] =
        action === 'approve' || action === 'unhide'
          ? [{ action }]
          : (['silent', 'visible'] as const).map((disclosure) =>
              withDisclosure(action, disclosure, 'spam')
            );

      for (const given of actions) {
        const result = applyModeration(from, given);

        expect(isOk(result) && result.value.state).toBe(next);
      }
    }
  );

  it.each([
    ...(['held', 'hidden'] as const).map((from) => ({ action: 'hold' as const, from })),
    ...(['published', 'hidden'] as const).map((from) => ({ action: 'approve' as const, from })),
    ...(['held', 'hidden'] as const).map((from) => ({ action: 'hide' as const, from })),
    ...(['published', 'held'] as const).map((from) => ({ action: 'unhide' as const, from })),
  ])('refuses $action on a $from comment', ({ action, from }) => {
    const given: CommentModerationAction =
      action === 'approve' || action === 'unhide'
        ? { action }
        : withDisclosure(action, 'visible', 'spam');

    const result = applyModeration(from, given);

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.MODERATION_NOT_APPLICABLE,
      action,
      state: from,
      why: 'state',
    });
  });

  it.each([
    { action: 'hide' as const, from: 'published' as const },
    { action: 'remove' as const, from: 'published' as const },
    { action: 'remove' as const, from: 'held' as const },
  ])('wants a reason for a visible $action', ({ action, from }) => {
    const result = applyModeration(from, withDisclosure(action, 'visible'));

    expect(isErr(result) && result.error).toMatchObject({
      code: ErrorCodes.MODERATION_NOT_APPLICABLE,
      why: 'reason_required',
    });
  });

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
