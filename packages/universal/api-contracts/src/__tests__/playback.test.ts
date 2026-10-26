import { recordPlayback } from '../playback';

const event = {
  videoId: '0f8fad5b-d9cb-469f-a165-70867728950e',
  sessionUuid: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  eventType: 'heartbeat',
  currentTime: 30,
  duration: 120,
};

describe('packages/api-contracts: playback', () => {
  it('takes an event anonymously and answers 204', () => {
    expect(recordPlayback).toMatchObject({
      method: 'POST',
      path: '/v1/telemetry/playback',
      anonymous: true,
      status: 204,
    });
  });

  it('defaults the stall and the watched segment to zero', () => {
    expect(recordPlayback.body.parse(event)).toEqual({
      ...event,
      rebufferingMs: 0,
      watchedSeconds: 0,
    });
  });

  it.each([
    ['an unknown event type', { eventType: 'seek' }],
    ['a zero duration', { duration: 0 }],
    ['a negative position', { currentTime: -1 }],
    ['a session that is not a UUID', { sessionUuid: 'viewer-1' }],
    ['a fractional stall', { rebufferingMs: 1.5 }],
    ['a segment past ten minutes', { watchedSeconds: 601 }],
    ['a rendition that is not a label', { rendition: '720p; drop' }],
  ])('rejects %s', (_name, overrides) => {
    expect(recordPlayback.body.safeParse({ ...event, ...overrides }).success).toBe(false);
  });
});
