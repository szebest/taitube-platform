import { ApiError } from '@vp/api-client';
import { ErrorCodes } from '@vp/errors';
import { commentRefusal } from '../comment-refusal';

function refused(code: string, errors?: unknown[], retryAfterMs?: number) {
  return new ApiError(
    403,
    code,
    code,
    { type: 'x', title: code, status: 403, detail: code, code, instance: 'i', errors },
    retryAfterMs
  );
}

describe('apps/client/web: commentRefusal', () => {
  it.each([
    {
      name: 'comments off',
      error: refused(ErrorCodes.COMMENTS_DISABLED),
      refusal: { kind: 'comments-disabled' },
    },
    {
      name: 'subscribers only',
      error: refused(ErrorCodes.COMMENTS_SUBSCRIBERS_ONLY),
      refusal: { kind: 'subscribers-only' },
    },
    {
      name: 'a ban with its reason and end',
      error: refused(ErrorCodes.COMMENTS_BANNED, [
        { reason: 'Spam', expiresAt: '2026-11-12T00:00:00.000Z' },
      ]),
      refusal: { kind: 'banned', reason: 'Spam', expiresAt: '2026-11-12T00:00:00.000Z' },
    },
    {
      name: 'a ban that says nothing',
      error: refused(ErrorCodes.COMMENTS_BANNED),
      refusal: { kind: 'banned', reason: null, expiresAt: null },
    },
    {
      name: 'an account that opens on a day',
      error: refused(ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW, [{ opensAt: '2026-11-12' }]),
      refusal: { kind: 'account-too-new', opensAt: '2026-11-12' },
    },
    {
      name: 'slow mode by its header',
      error: refused(ErrorCodes.COMMENTS_SLOW_MODE, [{ retryAfter: 9 }], 12_000),
      refusal: { kind: 'slow-mode', retryAfterMs: 12_000 },
    },
    {
      name: 'slow mode by its detail when the header is gone',
      error: refused(ErrorCodes.COMMENTS_SLOW_MODE, [{ retryAfter: 9 }]),
      refusal: { kind: 'slow-mode', retryAfterMs: 9000 },
    },
  ])('reads $name', ({ error, refusal }) => {
    expect(commentRefusal(error)).toEqual(refusal);
  });

  it.each([
    { name: 'another API failure', error: refused(ErrorCodes.INTERNAL) },
    {
      name: 'an account that does not say when it opens',
      error: refused(ErrorCodes.COMMENTS_ACCOUNT_TOO_NEW),
    },
    { name: 'a network failure', error: new TypeError('Failed to fetch') },
    { name: 'no error', error: null },
  ])('reads $name as no refusal', ({ error }) => {
    expect(commentRefusal(error)).toBeNull();
  });
});
