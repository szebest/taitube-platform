import { recordView } from '../views';

const TELEMETRY = {
  sessionId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  watchSeconds: 12.5,
  videoDuration: 90,
};

describe('packages/api-contracts: views', () => {
  it('accepts a beacon anonymously with a 202', () => {
    expect(recordView).toMatchObject({
      method: 'POST',
      path: '/v1/videos/:id/views',
      anonymous: true,
      status: 202,
    });
  });

  it('parses a well-formed beacon', () => {
    expect(recordView.body.parse(TELEMETRY)).toEqual(TELEMETRY);
  });

  it.each([
    ['a session that is not a UUID', { sessionId: 'abc' }],
    ['negative watch time', { watchSeconds: -1 }],
    ['a zero duration', { videoDuration: 0 }],
    ['watch time past a day', { watchSeconds: 86_401 }],
  ])('rejects %s', (_name, override) => {
    expect(recordView.body.safeParse({ ...TELEMETRY, ...override }).success).toBe(false);
  });
});
