import { ErrorCodes, isInputFailure } from '@vp/errors';
import {
  cannotSubscribeToSelf,
  channelForbidden,
  channelNotFound,
  handleChangeTooSoon,
  handleReserved,
  handleTaken,
  imageUploadNotFound,
  invalidSpotlightVideo,
} from '../failures';

describe('@vp/domain-rules: channel failures', () => {
  it.each([
    {
      name: 'channelNotFound',
      failure: channelNotFound('@me'),
      code: ErrorCodes.CHANNEL_NOT_FOUND,
    },
    { name: 'handleTaken', failure: handleTaken('me'), code: ErrorCodes.HANDLE_ALREADY_TAKEN },
    {
      name: 'cannotSubscribeToSelf',
      failure: cannotSubscribeToSelf('c1'),
      code: ErrorCodes.CANNOT_SUBSCRIBE_TO_SELF,
    },
    { name: 'channelForbidden', failure: channelForbidden('c1'), code: ErrorCodes.FORBIDDEN },
    {
      name: 'handleChangeTooSoon',
      failure: handleChangeTooSoon(new Date(0)),
      code: ErrorCodes.HANDLE_CHANGE_TOO_SOON,
    },
    {
      name: 'handleReserved',
      failure: handleReserved('me', new Date(0)),
      code: ErrorCodes.HANDLE_RESERVED,
    },
    {
      name: 'imageUploadNotFound',
      failure: imageUploadNotFound('u1'),
      code: ErrorCodes.IMAGE_UPLOAD_NOT_FOUND,
    },
  ])('$name carries $code and stays off the wire', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(isInputFailure(failure)).toBe(false);
  });

  it('names the handle that was taken', () => {
    expect(handleTaken('me')).toMatchObject({ handle: 'me' });
  });

  it('names the field and the problem of a refused spotlight video, which the client reads', () => {
    const failure = invalidSpotlightVideo('trailerVideoId', 'v1', 'not-public');

    expect(isInputFailure(failure)).toBe(true);
    expect(failure).toMatchObject({
      code: ErrorCodes.INVALID_SPOTLIGHT_VIDEO,
      field: 'trailerVideoId',
      problem: 'not-public',
    });
  });

  it('says when a handle can change again and when a reserved one is released', () => {
    const at = new Date('2026-04-01T00:00:00.000Z');

    expect(handleChangeTooSoon(at)).toMatchObject({ availableAt: at.toISOString() });
    expect(handleReserved('me', at)).toMatchObject({ handle: 'me', availableAt: at.toISOString() });
  });
});
