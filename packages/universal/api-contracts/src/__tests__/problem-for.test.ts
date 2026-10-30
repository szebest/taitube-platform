import { ErrorCodes, databaseUnavailable } from '@vp/errors';
import { problemFor } from '../problem-for';

const tooLarge = {
  code: ErrorCodes.UPLOAD_TOO_LARGE,
  message: 'File exceeds the 5 GB upload ceiling',
  field: 'file',
  limitBytes: 5_000_000_000,
} as const;

describe('@vp/api-contracts: problemFor', () => {
  it('reads the status from PROBLEM_STATUS', () => {
    expect(problemFor(tooLarge, '/v1/uploads').status).toBe(422);
  });

  it('renders the RFC 9457 envelope', () => {
    expect(problemFor(tooLarge, '/v1/uploads')).toMatchObject({
      type: 'https://errors.video-pipeline.local/UPLOAD_TOO_LARGE',
      code: ErrorCodes.UPLOAD_TOO_LARGE,
      detail: 'File exceeds the 5 GB upload ceiling',
      instance: '/v1/uploads',
    });
  });

  it("projects an input failure's payload into errors, naming the field and the limit", () => {
    expect(problemFor(tooLarge, '/v1/uploads').errors).toEqual([
      { field: 'file', limitBytes: 5_000_000_000 },
    ]);
  });

  it('keeps an infra payload off the wire entirely', () => {
    const problem = problemFor(databaseUnavailable('findWithDetails'), '/v1/videos/1');

    expect(problem.errors).toBeUndefined();
    expect(JSON.stringify(problem)).not.toContain('findWithDetails');
    expect(problem.status).toBe(503);
  });

  it('keeps a cause off the wire', () => {
    const failure = databaseUnavailable('insert', new Error('ECONNREFUSED 127.0.0.1:5432'));

    expect(JSON.stringify(problemFor(failure, '/v1/videos'))).not.toContain('ECONNREFUSED');
  });

  it.each([
    { name: 'status', overrides: { status: 403 }, key: 'status', expected: 403 },
    { name: 'title', overrides: { title: 'Forbidden' }, key: 'title', expected: 'Forbidden' },
    { name: 'detail', overrides: { detail: 'nope' }, key: 'detail', expected: 'nope' },
  ])('lets a route override the $name', ({ overrides, key, expected }) => {
    expect(problemFor(tooLarge, '/v1/uploads', overrides)[key as 'title']).toBe(expected);
  });

  it('lets a presenter replace the projected payload', () => {
    const problem = problemFor(tooLarge, '/v1/uploads', {
      errors: [{ field: 'file', limit: tooLarge.limitBytes }],
    });

    expect(problem.errors).toEqual([{ field: 'file', limit: 5_000_000_000 }]);
  });
});
