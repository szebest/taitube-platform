import {
  applyVideoExperiment,
  createVideoExperiment,
  listVideoExperiments,
  stopVideoExperiment,
} from '../video-experiments';

describe('packages/api-contracts: video experiments', () => {
  it.each([
    {
      endpoint: listVideoExperiments,
      method: 'GET',
      path: '/v1/creator/videos/:id/experiments',
      status: 200,
    },
    {
      endpoint: createVideoExperiment,
      method: 'POST',
      path: '/v1/creator/videos/:id/experiments',
      status: 201,
    },
    {
      endpoint: stopVideoExperiment,
      method: 'POST',
      path: '/v1/creator/videos/:id/experiments/:experimentId/stop',
      status: 200,
    },
    {
      endpoint: applyVideoExperiment,
      method: 'POST',
      path: '/v1/creator/videos/:id/experiments/:experimentId/apply',
      status: 200,
    },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it.each([
    { body: { kind: 'title', variants: [{ title: 'A' }, { title: 'B' }] }, ok: true },
    { body: { kind: 'thumbnail', variants: [{ thumbnail: { source: 'poster' } }] }, ok: true },
    { body: { kind: 'colour', variants: [] }, ok: false },
    { body: { kind: 'title', variants: [{ thumbnail: { source: 'custom' } }] }, ok: false },
  ])('takes $body.kind with its variants: $ok', ({ body, ok }) => {
    expect(createVideoExperiment.body.safeParse(body).success).toBe(ok);
  });

  it('applies only a lettered variant under a version', () => {
    expect(applyVideoExperiment.body.safeParse({ variantId: 'b', version: 3 }).success).toBe(true);
    expect(applyVideoExperiment.body.safeParse({ variantId: 'd', version: 3 }).success).toBe(false);
  });
});
