import { ApiErrorCodes } from '../api-error-codes';
import { ErrorCodes } from '../error-codes';
import { PipelineErrorCodes } from '../pipeline-error-codes';

describe('@vp/errors: the merged taxonomy', () => {
  it('is the union of the API and pipeline vocabularies', () => {
    expect(Object.keys(ErrorCodes).sort()).toEqual(
      [...Object.keys(ApiErrorCodes), ...Object.keys(PipelineErrorCodes)].sort()
    );
  });

  it('maps every key to its own name', () => {
    for (const [key, value] of Object.entries(ErrorCodes)) {
      expect(value).toBe(key);
    }
  });

  it('shares no code between the two vocabularies', () => {
    const overlap = Object.keys(ApiErrorCodes).filter((key) => key in PipelineErrorCodes);

    expect(overlap).toEqual([]);
  });
});
