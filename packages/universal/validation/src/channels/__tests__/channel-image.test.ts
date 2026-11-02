import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { validateChannelImage } from '../channel-image';

const MEGABYTE = 1024 * 1024;
const MAX_BYTES = { avatar: 5 * MEGABYTE, banner: 10 * MEGABYTE } as const;

describe('@vp/validation: validateChannelImage', () => {
  it.each([
    { kind: 'avatar', contentType: 'image/jpeg', sizeBytes: MAX_BYTES.avatar },
    { kind: 'avatar', contentType: 'image/png', sizeBytes: 1 },
    { kind: 'banner', contentType: 'image/webp', sizeBytes: MAX_BYTES.banner },
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
      sizeBytes: MAX_BYTES.avatar + 1,
      code: ErrorCodes.UPLOAD_TOO_LARGE,
    },
    {
      kind: 'banner',
      contentType: 'image/png',
      sizeBytes: MAX_BYTES.banner + 1,
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
      sizeBytes: MAX_BYTES.avatar + 1,
    } as const;

    expect(isOk(validateChannelImage(avatarSized))).toBe(true);
  });
});
