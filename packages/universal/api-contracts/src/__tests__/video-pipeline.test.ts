import {
  completeVideoReplacement,
  getClipSuggestions,
  listVideoGenerations,
  revertVideoEdits,
  saveVideoEdits,
  startVideoReplacement,
} from '../video-pipeline';

const blur = {
  startMs: 0,
  endMs: 1_000,
  shape: 'rect',
  x: 0.1,
  y: 0.1,
  w: 0.2,
  h: 0.2,
  strength: 5,
};

describe('packages/api-contracts: video pipeline', () => {
  it.each([
    {
      endpoint: listVideoGenerations,
      method: 'GET',
      path: '/v1/creator/videos/:id/generations',
      status: 200,
    },
    {
      endpoint: startVideoReplacement,
      method: 'POST',
      path: '/v1/videos/:id/replacement',
      status: 201,
    },
    {
      endpoint: completeVideoReplacement,
      method: 'POST',
      path: '/v1/videos/:id/replacement/complete',
      status: 202,
    },
    { endpoint: saveVideoEdits, method: 'PUT', path: '/v1/videos/:id/edits', status: 202 },
    {
      endpoint: revertVideoEdits,
      method: 'POST',
      path: '/v1/videos/:id/edits/revert',
      status: 200,
    },
    {
      endpoint: getClipSuggestions,
      method: 'GET',
      path: '/v1/creator/videos/:id/clip-suggestions',
      status: 200,
    },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it.each([
    { scenario: 'a trim alone', body: { trim: { startMs: 0, endMs: 1_000 }, blurs: [] }, ok: true },
    {
      scenario: 'an ellipse',
      body: { trim: null, blurs: [{ ...blur, shape: 'ellipse' }] },
      ok: true,
    },
    {
      scenario: 'a region past the frame',
      body: { trim: null, blurs: [{ ...blur, w: 1.2 }] },
      ok: false,
    },
    {
      scenario: 'a strength past the limit',
      body: { trim: null, blurs: [{ ...blur, strength: 21 }] },
      ok: false,
    },
    {
      scenario: 'twenty-one blurs',
      body: { trim: null, blurs: Array.from({ length: 21 }, () => blur) },
      ok: false,
    },
    {
      scenario: 'a polygon',
      body: { trim: null, blurs: [{ ...blur, shape: 'polygon' }] },
      ok: false,
    },
  ])('reads an edit list with $scenario: $ok', ({ body, ok }) => {
    expect(saveVideoEdits.body.safeParse(body).success).toBe(ok);
  });
});
