import { ErrorCodes } from '@vp/errors';
import { isErr } from '@vp/result';
import { ADMIN, OWNER, STRANGER, aVideo } from '../../__tests__/entities';
import { decideScreeningAppeal, decideScreeningRead } from '../appeal-screening.rule';

const rejectedByScreening = aVideo({
  status: 'REJECTED',
  errorCode: ErrorCodes.SCREENING_REJECTED,
  visibility: 'private',
});

const codeOf = (result: ReturnType<typeof decideScreeningAppeal>) =>
  isErr(result) ? result.error.code : null;

describe('@vp/domain-rules: decideScreeningAppeal', () => {
  it.each([
    {
      name: 'the owner of a screening rejection',
      actor: OWNER,
      video: rejectedByScreening,
      code: null,
    },
    {
      name: 'the owner of a takedown by a moderator',
      actor: OWNER,
      video: aVideo({ status: 'REJECTED', visibility: 'private' }),
      code: ErrorCodes.FORBIDDEN,
    },
    {
      name: 'the owner of a video still on hold',
      actor: OWNER,
      video: aVideo({ status: 'HELD', visibility: 'private' }),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'a stranger, who cannot read the private video',
      actor: STRANGER,
      video: rejectedByScreening,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    { name: 'an admin, who may do anything', actor: ADMIN, video: rejectedByScreening, code: null },
    {
      name: 'nobody signed in',
      actor: null,
      video: rejectedByScreening,
      code: ErrorCodes.UNAUTHORIZED,
    },
    { name: 'an absent video', actor: OWNER, video: null, code: ErrorCodes.VIDEO_NOT_FOUND },
  ])('answers $name with $code', ({ actor, video, code }) => {
    expect(codeOf(decideScreeningAppeal({ actor, video, videoId: 'video-1' }))).toBe(code);
  });
});

describe('@vp/domain-rules: decideScreeningRead', () => {
  it.each([
    { name: 'the owner', actor: OWNER, video: rejectedByScreening, code: null },
    {
      name: 'a stranger',
      actor: STRANGER,
      video: rejectedByScreening,
      code: ErrorCodes.VIDEO_NOT_FOUND,
    },
    {
      name: 'a stranger to a public video',
      actor: STRANGER,
      video: aVideo({ status: 'HELD' }),
      code: ErrorCodes.FORBIDDEN,
    },
    {
      name: 'nobody signed in',
      actor: null,
      video: rejectedByScreening,
      code: ErrorCodes.UNAUTHORIZED,
    },
  ])('answers $name with $code', ({ actor, video, code }) => {
    expect(codeOf(decideScreeningRead({ actor, video, videoId: 'video-1' }))).toBe(code);
  });
});
