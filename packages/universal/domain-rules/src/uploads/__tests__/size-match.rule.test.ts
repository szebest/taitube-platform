import { ErrorCodes } from '@vp/errors';
import { isErr, isOk } from '@vp/result';
import { aVideo } from '../../__tests__/entities';
import { decideSizeMatch } from '../size-match.rule';

describe('@vp/domain-rules: decideSizeMatch', () => {
  it('accepts an object whose size matches what was declared', () => {
    expect(isOk(decideSizeMatch({ video: aVideo({ sourceSizeBytes: 100 }), actualSizeBytes: 100 }))).toBe(
      true
    );
  });

  it('rejects an object whose size disagrees', () => {
    const result = decideSizeMatch({
      video: aVideo({ sourceSizeBytes: 100 }),
      actualSizeBytes: 200,
    });

    expect(isErr(result) && result.error.code).toBe(ErrorCodes.UPLOAD_SIZE_MISMATCH);
  });

  it.each([{ declared: null }, { declared: 0 }])(
    'accepts any size when the client declared $declared',
    ({ declared }) => {
      const video = aVideo({ sourceSizeBytes: declared });

      expect(isOk(decideSizeMatch({ video, actualSizeBytes: 999 }))).toBe(true);
    }
  );
});
