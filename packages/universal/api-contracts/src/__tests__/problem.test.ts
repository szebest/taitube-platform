import { ErrorCodes } from '@vp/errors';
import { ProblemSchema, problemResponse } from '../problem';

const problem = {
  type: 'https://errors.video-pipeline.local/VIDEO_NOT_FOUND',
  title: 'Not Found',
  status: 404,
  detail: 'Video 1 not found',
  code: ErrorCodes.VIDEO_NOT_FOUND,
  instance: '/v1/videos/1',
};

describe('packages/api-contracts: problem', () => {
  it('accepts an RFC 9457 body', () => {
    expect(ProblemSchema.parse(problem)).toMatchObject({ status: 404 });
  });

  it('narrows code to the declared set', () => {
    const schema = problemResponse([ErrorCodes.VIDEO_NOT_FOUND]);

    expect(schema.safeParse(problem).success).toBe(true);
    expect(schema.safeParse({ ...problem, code: ErrorCodes.FORBIDDEN }).success).toBe(false);
  });

  it('leaves code open when no set is declared', () => {
    expect(problemResponse([]).safeParse({ ...problem, code: 'ANYTHING' }).success).toBe(true);
  });
});
