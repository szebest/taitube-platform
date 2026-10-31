import { ErrorCodes, isInputFailure } from '@vp/errors';
import {
  invalidPickVideo,
  invalidPickWindow,
  nothingToPick,
  pickNotFound,
  pickWindowOverlap,
} from '../failures';

describe('@vp/domain-rules: pick failures', () => {
  it('names the missing pick and stays off the wire', () => {
    const failure = pickNotFound('p1');

    expect(failure).toMatchObject({ code: ErrorCodes.PICK_NOT_FOUND, pickId: 'p1' });
    expect(isInputFailure(failure)).toBe(false);
  });

  it('names the window field that was refused and is wire-safe', () => {
    const failure = invalidPickWindow('endsAt', 'nope');

    expect(failure).toMatchObject({ code: ErrorCodes.VALIDATION_FAILED, field: 'endsAt' });
    expect(isInputFailure(failure)).toBe(true);
  });

  it('names the video field with the refused id', () => {
    expect(invalidPickVideo('v1')).toMatchObject({
      code: ErrorCodes.VALIDATION_FAILED,
      field: 'videoId',
      videoId: 'v1',
    });
  });

  it('reports an empty home as a missing video, with nothing to name', () => {
    expect(nothingToPick()).toMatchObject({ code: ErrorCodes.VIDEO_NOT_FOUND });
  });

  it('re-exports the overlap failure the stores report', () => {
    expect(pickWindowOverlap(new Date(0), new Date(1)).code).toBe(ErrorCodes.PICK_WINDOW_OVERLAP);
  });
});
