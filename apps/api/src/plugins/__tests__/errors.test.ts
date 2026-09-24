import { transportProblem } from '../errors';

describe('apps/api/plugins: transportProblem', () => {
  it.each([
    { status: 400, title: 'Bad Request', code: 'VALIDATION_FAILED' },
    { status: 413, title: 'Payload Too Large', code: 'VALIDATION_FAILED' },
    { status: 415, title: 'Unsupported Media Type', code: 'UNSUPPORTED_CONTENT_TYPE' },
    { status: 401, title: 'Unauthorized', code: 'UNAUTHORIZED' },
  ])('titles a $status from the HTTP status and names it $code', ({ status, title, code }) => {
    expect(transportProblem(status, 'refused', '/v1/uploads')).toMatchObject({
      status,
      title,
      code,
      detail: 'refused',
      instance: '/v1/uploads',
    });
  });
});
