import { ErrorCodes, isInputFailure } from '@vp/errors';
import {
  captionLanguageTaken,
  captionNotFound,
  captionOverwriteUnconfirmed,
  captionTrackLimit,
} from '../failures';

describe('@vp/domain-rules: caption failures', () => {
  it.each([
    { failure: captionNotFound('v1', 'en'), code: ErrorCodes.CAPTION_NOT_FOUND },
    { failure: captionTrackLimit('v1', 10), code: ErrorCodes.CAPTION_TRACK_LIMIT },
    { failure: captionLanguageTaken('v1', 'de'), code: ErrorCodes.VALIDATION_FAILED },
    {
      failure: captionOverwriteUnconfirmed('v1', 'c1'),
      code: ErrorCodes.CAPTION_OVERWRITE_UNCONFIRMED,
    },
  ])('$code carries the video id, off the wire', ({ failure, code }) => {
    expect(failure).toMatchObject({ code, videoId: 'v1' });
    expect(isInputFailure(failure)).toBe(false);
  });
});
