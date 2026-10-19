import {
  type UserEvent,
  UserEventFrameSchema,
  UserStreamEventSchema,
  streamMyEvents,
  streamVideoEvents,
} from '../events';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000e1';

function processing(change: Extract<UserEvent, { type: 'video.processing' }>['payload']['change']) {
  return { type: 'video.processing', payload: { videoId: VIDEO_ID, change } } as const;
}

describe('packages/api-contracts: events', () => {
  it('streams one video and the caller feed over SSE', () => {
    expect(streamVideoEvents).toMatchObject({ method: 'GET', path: '/v1/videos/:id/events' });
    expect(streamMyEvents).toMatchObject({ method: 'GET', path: '/v1/me/events' });
  });

  it('carries the replay position as last-event-id', () => {
    expect(streamVideoEvents.query.parse({ 'last-event-id': '42' })).toEqual({
      'last-event-id': '42',
    });
    expect(streamVideoEvents.query.parse(undefined)).toBeUndefined();
  });

  it('caps concurrent streams with a 429', () => {
    expect(streamVideoEvents.errors[429]).toContain('RATE_LIMITED');
    expect(streamMyEvents.errors[429]).toContain('RATE_LIMITED');
  });

  it.each([
    ['hello', { type: 'hello', payload: { resume: 'expired' } }],
    ['a status change', processing({ kind: 'status', status: 'READY' })],
    [
      'a progress tick',
      processing({ kind: 'progress', rendition: '720p', percent: 40, overall: 20 }),
    ],
  ])('reads %s off the user stream', (_label, event) => {
    expect(UserStreamEventSchema.parse(event)).toEqual(event);
  });

  it.each([
    ['an unknown type', { type: 'video.deleted', payload: { videoId: VIDEO_ID } }],
    ['an unknown resume', { type: 'hello', payload: { resume: 'partial' } }],
    [
      'an unknown change',
      { type: 'video.processing', payload: { videoId: VIDEO_ID, change: { kind: 'deleted' } } },
    ],
  ])('refuses %s', (_label, event) => {
    expect(UserStreamEventSchema.safeParse(event).success).toBe(false);
  });

  it('frames a published event with its log id, and a progress tick without one', () => {
    const status = processing({ kind: 'status', status: 'FAILED' });
    const tick = processing({ kind: 'progress', rendition: '480p', percent: 10, overall: 5 });

    expect(UserEventFrameSchema.parse({ id: 7, ...status })).toEqual({ id: 7, ...status });
    expect(UserEventFrameSchema.parse(tick)).toEqual(tick);
  });
});
