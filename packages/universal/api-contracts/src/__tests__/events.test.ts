import { type UserEvent, UserEventFrameSchema, streamMyEvents, streamVideoEvents } from '../events';
import type { z } from 'zod';

const VIDEO_ID = '00000000-0000-7000-8000-0000000000e1';

function processing(change: Extract<UserEvent, { type: 'video.processing' }>['payload']['change']) {
  return { type: 'video.processing', payload: { videoId: VIDEO_ID, change } } as const;
}

describe('packages/api-contracts: events', () => {
  it('validates exactly the domain union, so a member cannot be added to one side alone', () => {
    expectTypeOf<
      Exclude<z.infer<typeof streamMyEvents.result>, { type: 'hello' }>
    >().toEqualTypeOf<UserEvent>();
  });

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
    ['hello', { type: 'hello', payload: { resume: 'expired', unreadNotifications: 3 } }],
    ['a status change', processing({ kind: 'status', status: 'READY' })],
    [
      'a progress tick',
      processing({ kind: 'progress', rendition: '720p', percent: 40, overall: 20 }),
    ],
    [
      'a preferences save',
      { type: 'preferences.updated', payload: { sections: ['playback'], version: 2 } },
    ],
    [
      'a created notification',
      {
        type: 'notification.created',
        payload: {
          notification: {
            id: VIDEO_ID,
            kind: 'upload',
            actorChannelId: VIDEO_ID,
            videoId: VIDEO_ID,
            commentId: null,
            payload: {
              count: 3,
              actor: { handle: 'night.kitchen', displayName: 'Night Kitchen', avatarUrl: null },
              videoTitle: 'Dinner',
              excerpt: null,
              outcome: null,
            },
            read: false,
            createdAt: '2026-01-02T03:04:05.000Z',
          },
          unreadCount: 4,
        },
      },
    ],
    [
      'notifications read by id',
      { type: 'notification.read', payload: { scope: 'ids', ids: [VIDEO_ID], unreadCount: 1 } },
    ],
    [
      'every notification read',
      { type: 'notification.read', payload: { scope: 'all', unreadCount: 0 } },
    ],
  ])('reads %s off the user stream', (_label, event) => {
    expect(streamMyEvents.result.parse(event)).toEqual(event);
  });

  it.each([
    ['an unknown type', { type: 'video.deleted', payload: { videoId: VIDEO_ID } }],
    [
      'an unknown resume',
      { type: 'hello', payload: { resume: 'partial', unreadNotifications: 0 } },
    ],
    [
      'an unknown change',
      { type: 'video.processing', payload: { videoId: VIDEO_ID, change: { kind: 'deleted' } } },
    ],
    [
      'an unknown preferences section',
      { type: 'preferences.updated', payload: { sections: ['layout'], version: 2 } },
    ],
  ])('refuses %s', (_label, event) => {
    expect(streamMyEvents.result.safeParse(event).success).toBe(false);
  });

  it('frames a published event with its log id, and a progress tick without one', () => {
    const status = processing({ kind: 'status', status: 'FAILED' });
    const tick = processing({ kind: 'progress', rendition: '480p', percent: 10, overall: 5 });

    expect(UserEventFrameSchema.parse({ id: 7, ...status })).toEqual({ id: 7, ...status });
    expect(UserEventFrameSchema.parse(tick)).toEqual(tick);
  });
});
