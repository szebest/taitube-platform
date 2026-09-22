import { ApiErrorCodes } from '../api-error-codes';
import { PipelineErrorCodes } from '../pipeline-error-codes';

describe('@vp/errors: API error codes', () => {
  it('maps every key to its own name', () => {
    for (const [key, value] of Object.entries(ApiErrorCodes)) {
      expect(value).toBe(key);
    }
  });

  it('shares no code with the pipeline vocabulary', () => {
    const pipeline = new Set<string>(Object.values(PipelineErrorCodes));
    const overlap = Object.values(ApiErrorCodes).filter((code) => pipeline.has(code));
    expect(overlap).toEqual([]);
  });
});
