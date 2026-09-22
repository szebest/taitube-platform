import { ErrorCodes, isInputFailure } from '@vp/errors';
import { videoForbidden, videoNotFound, videoVersionConflict } from '../failures';

describe('@vp/domain-rules: video failures', () => {
  it.each([
    { name: 'videoNotFound', failure: videoNotFound('v1'), code: ErrorCodes.VIDEO_NOT_FOUND },
    { name: 'videoForbidden', failure: videoForbidden('v1'), code: ErrorCodes.FORBIDDEN },
    {
      name: 'videoVersionConflict',
      failure: videoVersionConflict('v1', 1, 2),
      code: ErrorCodes.VERSION_CONFLICT,
    },
  ])('$name carries $code and the video id', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(failure.videoId).toBe('v1');
  });

  it.each([
    { name: 'videoNotFound', failure: videoNotFound('v1') },
    { name: 'videoForbidden', failure: videoForbidden('v1') },
  ])('$name is not wire-safe, so its id never reaches Problem.errors', ({ failure }) => {
    expect(isInputFailure(failure)).toBe(false);
  });

  it('reports both versions of a conflict', () => {
    expect(videoVersionConflict('v1', 1, 2)).toMatchObject({
      expectedVersion: 1,
      actualVersion: 2,
    });
  });
});
