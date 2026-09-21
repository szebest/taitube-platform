import { PipelineErrorCodes } from '../pipeline-error-codes';

describe('@vp/errors: pipeline error codes', () => {
  it('maps every key to its own name', () => {
    for (const [key, value] of Object.entries(PipelineErrorCodes)) {
      expect(value).toBe(key);
    }
  });
});
