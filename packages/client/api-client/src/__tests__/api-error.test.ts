import { ApiContractError, ApiError, toApiError } from '../api-error';

const problem = {
  type: 'https://errors.video-pipeline.local/VIDEO_NOT_FOUND',
  title: 'Not Found',
  status: 404,
  detail: 'Video 1 not found',
  code: 'VIDEO_NOT_FOUND',
  instance: '/v1/videos/1',
};

describe('packages/api-client: errors', () => {
  it('lifts the code and detail out of a problem document', () => {
    const error = toApiError(404, problem);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.code).toBe('VIDEO_NOT_FOUND');
    expect(error.message).toBe('Video 1 not found');
    expect(error.problem).toEqual(problem);
  });

  it('falls back to the status when the body is not a problem document', () => {
    const error = toApiError(502, '<html>bad gateway</html>');

    expect(error.code).toBe('HTTP_ERROR');
    expect(error.message).toBe('Request failed with status 502');
    expect(error.problem).toBeUndefined();
  });

  it('names the endpoint and the failing fields when a payload breaks the contract', () => {
    const error = new ApiContractError('GET /v1/feed', [
      { path: ['items', 0, 'id'], message: 'Required' },
      { path: [], message: 'Expected object' },
    ]);

    expect(error.message).toContain('GET /v1/feed');
    expect(error.message).toContain('items.0.id Required');
    expect(error.message).toContain('<root> Expected object');
  });
});
