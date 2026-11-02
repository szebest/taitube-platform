import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { CHANNEL_IMAGE_MAX_BYTES, validateChannelImage } from '../channel-image';

describe('@vp/validation: validateChannelImage', () => {
  it.each([
    { kind: 'avatar', contentType: 'image/jpeg', sizeBytes: CHANNEL_IMAGE_MAX_BYTES.avatar },
    { kind: 'avatar', contentType: 'image/png', sizeBytes: 1 },
    { kind: 'banner', contentType: 'image/webp', sizeBytes: CHANNEL_IMAGE_MAX_BYTES.banner },
  ] as const)('accepts a $kind of type $contentType and $sizeBytes bytes', (input) => {
    const result = validateChannelImage(input);

    expect(isOk(result) && result.value).toEqual(input);
  });

  it.each([
    {
      kind: 'avatar',
      contentType: 'image/gif',
      sizeBytes: 10,
      code: ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
    },
    {
      kind: 'avatar',
      contentType: 'image/png',
      sizeBytes: CHANNEL_IMAGE_MAX_BYTES.avatar + 1,
      code: ErrorCodes.UPLOAD_TOO_LARGE,
    },
    {
      kind: 'banner',
      contentType: 'image/png',
      sizeBytes: CHANNEL_IMAGE_MAX_BYTES.banner + 1,
      code: ErrorCodes.UPLOAD_TOO_LARGE,
    },
  ] as const)(
    'rejects a $kind of type $contentType and $sizeBytes bytes as $code',
    ({ code, ...input }) => {
      const result = validateChannelImage(input);

      expect(isErr(result) && result.error.code).toBe(code);
    }
  );

  it('holds the banner to a larger cap than the avatar', () => {
    const avatarSized = {
      kind: 'banner',
      contentType: 'image/png',
      sizeBytes: CHANNEL_IMAGE_MAX_BYTES.avatar + 1,
    } as const;

    expect(isOk(validateChannelImage(avatarSized))).toBe(true);
  });
});
