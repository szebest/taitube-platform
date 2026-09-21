import { EventStreamQuerySchema, streamMyEvents, streamVideoEvents } from '../events';

describe('packages/api-contracts: events', () => {
  it('streams one video and the caller feed over SSE', () => {
    expect(streamVideoEvents).toMatchObject({ method: 'GET', path: '/v1/videos/:id/events' });
    expect(streamMyEvents).toMatchObject({ method: 'GET', path: '/v1/me/events' });
  });

  it('carries the replay position as last-event-id', () => {
    expect(EventStreamQuerySchema.parse({ 'last-event-id': '42' })).toEqual({
      'last-event-id': '42',
    });
    expect(EventStreamQuerySchema.parse(undefined)).toBeUndefined();
  });

  it('caps concurrent streams with a 429', () => {
    expect(streamVideoEvents.errors[429]).toContain('RATE_LIMITED');
    expect(streamMyEvents.errors[429]).toContain('RATE_LIMITED');
  });
});
