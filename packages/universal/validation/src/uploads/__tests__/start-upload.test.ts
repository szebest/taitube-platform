import { ErrorCodes } from '@vp/errors';
import { isOk } from '@vp/result';
import { ALLOWED_CONTENT_TYPES } from '../allowed-content-type';
import { type UploadLimits, validateStartUpload } from '../start-upload';

const input = {
  filename: 'clip.mp4',
  sizeBytes: 1_000,
  contentType: 'video/mp4',
  title: 'My clip',
};

const limits: UploadLimits = {
  maxBytes: 10_000,
  allowedContentTypes: ALLOWED_CONTENT_TYPES,
  maxTitleLength: 10,
};

describe('@vp/validation: validateStartUpload', () => {
  it('accepts a well-formed submission and returns the input unchanged', () => {
    const result = validateStartUpload(input, limits);

    expect(isOk(result)).toBe(true);
    expect(isOk(result) && result.value).toBe(input);
  });

  it.each([
    {
      name: 'a size over the ceiling',
      patch: { sizeBytes: 10_001 },
      code: ErrorCodes.UPLOAD_TOO_LARGE,
    },
    {
      name: 'a content type outside the allowed list',
      patch: { contentType: 'image/png' },
      code: ErrorCodes.UNSUPPORTED_CONTENT_TYPE,
    },
    {
      name: 'a title over the length limit',
      patch: { title: 'a'.repeat(11) },
      code: ErrorCodes.VALIDATION_FAILED,
    },
    { name: 'an empty title', patch: { title: '' }, code: ErrorCodes.VALIDATION_FAILED },
  ])('rejects $name', ({ patch, code }) => {
    const result = validateStartUpload({ ...input, ...patch }, limits);

    expect(isOk(result)).toBe(false);
    expect(!isOk(result) && result.error.code).toBe(code);
  });

  it.each([{ title: undefined }, { title: null }])(
    'treats an absent title as acceptable',
    ({ title }) => {
      expect(isOk(validateStartUpload({ ...input, title }, limits))).toBe(true);
    }
  );

  it('reports the size before the content type when both are wrong', () => {
    const result = validateStartUpload(
      { ...input, sizeBytes: 10_001, contentType: 'image/png' },
      limits
    );

    expect(!isOk(result) && result.error.code).toBe(ErrorCodes.UPLOAD_TOO_LARGE);
  });
});
