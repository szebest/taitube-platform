import { isErr, isOk } from '@kit/result';
import { ErrorCodes } from '@vp/errors';
import { anUpload } from '../../__tests__/entities';
import { decideUploadOpen, uploadSourcesInto } from '../upload-open.rule';

const before = new Date('2026-01-01T00:30:00.000Z');
const after = new Date('2026-01-01T02:00:00.000Z');

describe('@vp/domain-rules: decideUploadOpen', () => {
  it('returns the upload while it is open and unexpired', () => {
    const upload = anUpload();

    expect(isOk(decideUploadOpen({ upload, now: before }))).toBe(true);
  });

  it.each([{ status: 'ABORTED' as const }, { status: 'COMPLETED' as const }])(
    'reports a $status upload as UPLOAD_NOT_OPEN',
    ({ status }) => {
      const result = decideUploadOpen({ upload: anUpload({ status }), now: before });

      expect(isErr(result) && result.error.code).toBe(ErrorCodes.UPLOAD_NOT_OPEN);
    }
  );

  it('reports an upload past its expiry as UPLOAD_EXPIRED', () => {
    const result = decideUploadOpen({ upload: anUpload(), now: after });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.UPLOAD_EXPIRED);
  });

  it('takes the instant as an argument rather than reading a clock', () => {
    const upload = anUpload({ expiresAt: new Date('2026-01-01T01:00:00.000Z') });

    expect(isOk(decideUploadOpen({ upload, now: new Date('2026-01-01T00:59:59.999Z') }))).toBe(
      true
    );
    expect(isOk(decideUploadOpen({ upload, now: new Date('2026-01-01T01:00:00.000Z') }))).toBe(
      false
    );
  });

  it.each([
    { status: 'COMPLETED', sources: ['OPEN'] },
    { status: 'ABORTED', sources: ['OPEN'] },
    { status: 'OPEN', sources: [] },
  ] as const)('lets an upload become $status only from $sources', ({ status, sources }) => {
    expect(uploadSourcesInto(status)).toEqual(sources);
  });
});
