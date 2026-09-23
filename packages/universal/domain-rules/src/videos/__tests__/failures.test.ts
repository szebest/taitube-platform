import { ErrorCodes, isInputFailure } from '@vp/errors';
import {
  videoEditForbidden,
  videoForbidden,
  videoNotFound,
  videoReadRequiresAuth,
  videoStatusNotEligible,
} from '../failures';

describe('@vp/domain-rules: video failures', () => {
  it.each([
    { name: 'videoNotFound', failure: videoNotFound('v1'), code: ErrorCodes.VIDEO_NOT_FOUND },
    { name: 'videoForbidden', failure: videoForbidden('v1'), code: ErrorCodes.FORBIDDEN },
    { name: 'videoEditForbidden', failure: videoEditForbidden('v1'), code: ErrorCodes.FORBIDDEN },
    {
      name: 'videoReadRequiresAuth',
      failure: videoReadRequiresAuth('v1'),
      code: ErrorCodes.UNAUTHORIZED,
    },
    {
      name: 'videoStatusNotEligible',
      failure: videoStatusNotEligible('v1', 'DELETED', ['READY']),
      code: ErrorCodes.VALIDATION_FAILED,
    },
  ])('$name carries $code and the video id', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(failure.videoId).toBe('v1');
  });

  it.each([
    { name: 'videoNotFound', failure: videoNotFound('v1') },
    { name: 'videoForbidden', failure: videoForbidden('v1') },
    { name: 'videoEditForbidden', failure: videoEditForbidden('v1') },
    { name: 'videoReadRequiresAuth', failure: videoReadRequiresAuth('v1') },
  ])('$name is not wire-safe, so its id never reaches Problem.errors', ({ failure }) => {
    expect(isInputFailure(failure)).toBe(false);
  });

  it('names the status it found and the ones it would have accepted', () => {
    const failure = videoStatusNotEligible('v1', 'DELETED', ['READY', 'FAILED']);

    expect(failure).toMatchObject({ status: 'DELETED', eligible: ['READY', 'FAILED'] });
    expect(failure.message).toContain('READY, FAILED');
  });

  it.each([
    { name: 'a caller who cannot see the video', failure: videoForbidden('v1'), readable: false },
    {
      name: 'a caller who can see it but not edit',
      failure: videoEditForbidden('v1'),
      readable: true,
    },
  ])(
    'records that $name had readable=$readable, which decides the disguise',
    ({ failure, readable }) => {
      expect(failure.readable).toBe(readable);
    }
  );
});
