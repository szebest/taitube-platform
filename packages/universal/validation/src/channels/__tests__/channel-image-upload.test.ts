import { expectErr, expectOk } from '@vp/testing/result';
import {
  validateChannelImageDimensions,
  validateChannelImageUploadRequest,
} from '../channel-image-upload';

const MB = 1024 * 1024;

describe('@vp/validation: channel image upload', () => {
  it.each([
    { kind: 'avatar', contentType: 'image/webp', sizeBytes: 2 * MB },
    { kind: 'banner', contentType: 'image/jpeg', sizeBytes: 6 * MB },
    { kind: 'banner', contentType: 'image/png', sizeBytes: 1 },
  ] as const)('accepts a $kind of $sizeBytes bytes as $contentType', (input) => {
    expect(expectOk(validateChannelImageUploadRequest(input))).toEqual(input);
  });

  it.each([
    { kind: 'avatar', contentType: 'image/png', sizeBytes: 2 * MB + 1, code: 'UPLOAD_TOO_LARGE' },
    { kind: 'banner', contentType: 'image/png', sizeBytes: 6 * MB + 1, code: 'UPLOAD_TOO_LARGE' },
    { kind: 'avatar', contentType: 'image/gif', sizeBytes: 100, code: 'UNSUPPORTED_CONTENT_TYPE' },
    {
      kind: 'banner',
      contentType: 'image/svg+xml',
      sizeBytes: 100,
      code: 'UNSUPPORTED_CONTENT_TYPE',
    },
  ] as const)(
    'refuses a $kind of $sizeBytes bytes as $contentType with $code',
    ({ code, ...input }) => {
      expect(expectErr(validateChannelImageUploadRequest(input)).code).toBe(code);
    }
  );

  it.each([
    { kind: 'avatar', width: 200, height: 200 },
    { kind: 'avatar', width: 4000, height: 300 },
    { kind: 'banner', width: 1024, height: 576 },
  ] as const)('accepts a $kind of $width x $height', ({ kind, ...size }) => {
    expect(expectOk(validateChannelImageDimensions(kind, size))).toEqual(size);
  });

  it.each([
    { kind: 'avatar', width: 199, height: 400 },
    { kind: 'avatar', width: 400, height: 199 },
    { kind: 'banner', width: 1023, height: 2000 },
    { kind: 'banner', width: 2000, height: 575 },
  ] as const)('refuses a $kind of $width x $height as too small', ({ kind, ...size }) => {
    expect(expectErr(validateChannelImageDimensions(kind, size))).toMatchObject({
      code: 'IMAGE_TOO_SMALL',
      ...size,
    });
  });
});
