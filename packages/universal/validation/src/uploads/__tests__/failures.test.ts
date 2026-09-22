import { ErrorCodes, isInputFailure } from '@vp/errors';
import { invalidTitle, unsupportedContentType, uploadTooLarge } from '../failures';

describe('@vp/validation: upload failures', () => {
  it.each([
    { name: 'uploadTooLarge', failure: uploadTooLarge(6, 5), field: 'sizeBytes' },
    {
      name: 'unsupportedContentType',
      failure: unsupportedContentType('image/png', ['video/mp4']),
      field: 'contentType',
    },
    { name: 'invalidTitle', failure: invalidTitle(200), field: 'title' },
  ])('$name names $field and is wire-safe', ({ failure, field }) => {
    expect(failure.field).toBe(field);
    expect(isInputFailure(failure)).toBe(true);
  });

  it('carries both the rejected size and the limit it broke', () => {
    expect(uploadTooLarge(6, 5)).toMatchObject({
      code: ErrorCodes.UPLOAD_TOO_LARGE,
      sizeBytes: 6,
      limitBytes: 5,
    });
  });

  it('carries the allowed list so a form can render it', () => {
    const failure = unsupportedContentType('image/png', ['video/mp4', 'video/webm']);

    expect(failure.allowed).toEqual(['video/mp4', 'video/webm']);
    expect(failure.message).toContain('video/mp4, video/webm');
  });
});
