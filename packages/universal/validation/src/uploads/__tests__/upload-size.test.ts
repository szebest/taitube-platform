import { err, ok } from '@vp/result';
import { uploadTooLarge } from '../failures';
import { validateUploadSize } from '../upload-size';

describe('@vp/validation: validateUploadSize', () => {
  it.each([
    { name: 'under the ceiling', sizeBytes: 10, expected: ok(10) },
    { name: 'exactly at the ceiling', sizeBytes: 100, expected: ok(100) },
  ])('accepts a size $name', ({ sizeBytes, expected }) => {
    expect(validateUploadSize(sizeBytes, 100)).toEqual(expected);
  });

  it('rejects a size over the ceiling and reports both numbers', () => {
    expect(validateUploadSize(101, 100)).toEqual(err(uploadTooLarge(101, 100)));
  });
});
