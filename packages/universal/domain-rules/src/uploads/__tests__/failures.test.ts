import { ErrorCodes, isInputFailure } from '@vp/errors';
import {
  notMultipart,
  partManifestMismatch,
  sourceMissing,
  uploadExpired,
  uploadNotFound,
  uploadNotOpen,
  uploadSizeMismatch,
} from '../failures';

const expiresAt = new Date('2026-01-01T00:00:00.000Z');

describe('@vp/domain-rules: upload failures', () => {
  it.each([
    {
      name: 'uploadNotOpen',
      failure: uploadNotOpen('u1', 'ABORTED'),
      code: ErrorCodes.UPLOAD_NOT_OPEN,
    },
    {
      name: 'uploadExpired',
      failure: uploadExpired('u1', expiresAt),
      code: ErrorCodes.UPLOAD_EXPIRED,
    },
    {
      name: 'partManifestMismatch',
      failure: partManifestMismatch('u1', 3, 2),
      code: ErrorCodes.VALIDATION_FAILED,
    },
    {
      name: 'uploadSizeMismatch',
      failure: uploadSizeMismatch('v1', 100, 200),
      code: ErrorCodes.UPLOAD_SIZE_MISMATCH,
    },
    { name: 'uploadNotFound', failure: uploadNotFound('u1'), code: ErrorCodes.VIDEO_NOT_FOUND },
    {
      name: 'sourceMissing',
      failure: sourceMissing('v1', 'videos/v1/source.mp4'),
      code: ErrorCodes.SOURCE_MISSING,
    },
    { name: 'notMultipart', failure: notMultipart('u1'), code: ErrorCodes.VALIDATION_FAILED },
  ])('$name carries $code and stays off the wire', ({ failure, code }) => {
    expect(failure.code).toBe(code);
    expect(isInputFailure(failure)).toBe(false);
  });

  it('reports both part counts', () => {
    expect(partManifestMismatch('u1', 3, 2).message).toBe('Expected 3 parts but received 2');
  });

  it('says so when the upload record has no part count at all', () => {
    expect(partManifestMismatch('u1', null, 2).message).toContain(
      'missing its multipart part count'
    );
  });

  it('reports both sizes', () => {
    expect(uploadSizeMismatch('v1', 100, 200)).toMatchObject({
      declaredSizeBytes: 100,
      actualSizeBytes: 200,
    });
  });
});
