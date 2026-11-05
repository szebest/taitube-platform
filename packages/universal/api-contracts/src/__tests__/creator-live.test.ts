import {
  getMyLiveStream,
  openMyLiveStream,
  stopMyLiveStream,
  updateMyLiveStream,
} from '../creator-live';

const view = {
  id: '00000000-0000-7000-8000-00000000f101',
  status: 'IDLE',
  title: '',
  description: '',
  visibility: 'public',
  archiveVisibility: 'public',
  startedAt: null,
  endedAt: null,
  videoId: null,
  ingest: { rtmpUrl: 'rtmp://localhost:1935/live', streamKey: 'k', whipUrl: 'http://localhost:8889/live/k/whip' },
};

describe('packages/api-contracts: creator live', () => {
  it.each([
    { endpoint: openMyLiveStream, method: 'POST', path: '/v1/me/live', status: 200 },
    { endpoint: getMyLiveStream, method: 'GET', path: '/v1/me/live', status: 200 },
    { endpoint: updateMyLiveStream, method: 'PATCH', path: '/v1/me/live/:id', status: 200 },
    { endpoint: stopMyLiveStream, method: 'POST', path: '/v1/me/live/:id/stop', status: 202 },
  ])('serves $method $path with $status', ({ endpoint, method, path, status }) => {
    expect(endpoint).toMatchObject({ method, path, status });
  });

  it.each([
    { scenario: 'an idle stream with its credentials', value: view, ok: true },
    { scenario: 'an ended stream without them', value: { ...view, status: 'ENDED', ingest: null }, ok: true },
    { scenario: 'an unknown status', value: { ...view, status: 'PAUSED' }, ok: false },
  ])('reads $scenario', ({ value, ok }) => {
    expect(openMyLiveStream.result.safeParse(value).success).toBe(ok);
  });

  it.each([
    { scenario: 'an archive visibility', body: { archiveVisibility: 'unlisted' }, ok: true },
    { scenario: 'a title of 100 characters', body: { title: 'a'.repeat(100) }, ok: true },
    { scenario: 'a title of 101 characters', body: { title: 'a'.repeat(101) }, ok: false },
    { scenario: 'an unknown visibility', body: { visibility: 'friends' }, ok: false },
  ])('takes $scenario: $ok', ({ body, ok }) => {
    expect(updateMyLiveStream.body.safeParse(body).success).toBe(ok);
  });
});
