import { getLiveOverlay, getLiveStream, LiveVideoEventSchemas, listLiveStreams } from '../live';

const STREAM_ID = '0190c3a0-5e1d-7000-8000-00000000e001';

describe('packages/api-contracts: live', () => {
  it.each([
    { endpoint: listLiveStreams, path: '/v1/live' },
    { endpoint: getLiveStream, path: '/v1/live/:id' },
    { endpoint: getLiveOverlay, path: '/v1/live/overlay/:token' },
  ])('serves GET $path to anyone', ({ endpoint, path }) => {
    expect(endpoint).toMatchObject({ method: 'GET', path, status: 200, anonymous: true });
  });

  it.each([
    { scenario: 'no limit', query: undefined, ok: true },
    { scenario: 'a limit of 48', query: { limit: '48' }, ok: true },
    { scenario: 'a limit of 49', query: { limit: '49' }, ok: false },
  ])('lists with $scenario: $ok', ({ query, ok }) => {
    expect(listLiveStreams.query.safeParse(query).success).toBe(ok);
  });

  it.each([
    { frame: 'a snapshot of a recording', data: { videoId: STREAM_ID, status: 'READY' }, live: undefined },
    {
      frame: 'a snapshot of a broadcast',
      data: { live: { liveStreamId: STREAM_ID, status: 'LIVE', viewers: 3 } },
      live: { liveStreamId: STREAM_ID, status: 'LIVE', viewers: 3 },
    },
  ])('reads $frame from the video stream', ({ data, live }) => {
    expect(LiveVideoEventSchemas.snapshot.parse(data).live).toEqual(live);
  });
});
