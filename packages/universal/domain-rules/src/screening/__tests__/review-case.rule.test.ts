import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { ADMIN, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import {
  type ScreeningAction,
  decideScreeningQueueAccess,
  decideScreeningReview,
} from '../review-case.rule';

const held = aVideo({ status: 'HELD' });
const input = (overrides: Partial<Parameters<typeof decideScreeningReview>[0]> = {}) => ({
  actor: ADMIN,
  video: held,
  videoId: held.id,
  action: 'approve' as ScreeningAction,
  openAppeal: null,
  ...overrides,
});

describe('@vp/domain-rules: decideScreeningQueueAccess', () => {
  it.each([
    { name: 'a moderator', actor: ADMIN, code: null },
    { name: 'the owner of a video', actor: OWNER, code: ErrorCodes.FORBIDDEN },
    { name: 'a stranger', actor: STRANGER, code: ErrorCodes.FORBIDDEN },
    { name: 'nobody signed in', actor: null, code: ErrorCodes.UNAUTHORIZED },
  ])('answers $name with $code', ({ actor, code }) => {
    const result = decideScreeningQueueAccess(actor);

    expect(isErr(result) ? result.error.code : null).toBe(code);
  });
});

describe('@vp/domain-rules: decideScreeningReview', () => {
  it.each([
    { name: 'a moderator approving a held video', overrides: {}, code: null },
    {
      name: 'a moderator rejecting a held video',
      overrides: { action: 'reject' as const },
      code: null,
    },
    {
      name: 'a moderator approving a video no longer held',
      overrides: { video: aVideo({ status: 'PROCESSING' }) },
      code: ErrorCodes.VERSION_CONFLICT,
    },
    {
      name: 'a moderator rejecting a video already approved',
      overrides: { video: aVideo({ status: 'READY' }), action: 'reject' as const },
      code: ErrorCodes.VERSION_CONFLICT,
    },
    {
      name: 'a moderator dismissing the flags of a public video',
      overrides: { video: aVideo({ status: 'READY' }), action: 'dismiss' as const },
      code: null,
    },
    {
      name: 'the owner approving their own video',
      overrides: { actor: OWNER },
      code: ErrorCodes.FORBIDDEN,
    },
    {
      name: 'a stranger rejecting',
      overrides: { actor: STRANGER, action: 'reject' as const },
      code: ErrorCodes.FORBIDDEN,
    },
    { name: 'nobody signed in', overrides: { actor: null }, code: ErrorCodes.UNAUTHORIZED },
    { name: 'an absent video', overrides: { video: null }, code: ErrorCodes.VIDEO_NOT_FOUND },
    {
      name: 'the moderator who rejected deciding the appeal',
      overrides: { openAppeal: { rejectedBy: ADMIN.id } },
      code: ErrorCodes.FORBIDDEN,
    },
    {
      name: 'another moderator deciding the appeal',
      overrides: { openAppeal: { rejectedBy: 'someone-else' } },
      code: null,
    },
    {
      name: 'an appeal whose rejecter is gone',
      overrides: { openAppeal: { rejectedBy: null } },
      code: null,
    },
  ])('answers $name with $code', ({ overrides, code }) => {
    const result = decideScreeningReview(input(overrides));

    expect(isErr(result) ? result.error.code : null).toBe(code);
    expect(isOk(result)).toBe(code === null);
  });
});
