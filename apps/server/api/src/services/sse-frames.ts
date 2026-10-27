import type { StreamResume, UserEventFrame } from '@vp/api-contracts';
import type { SseMessageEnvelope } from '@vp/events';
import { assertNever } from '@vp/result';
import type { SseFrame } from './sse-connection';

export function videoFrame({ id, event, data }: SseMessageEnvelope): SseFrame {
  const rendition = data['rendition'];
  return {
    id,
    event,
    data,
    ...(event === 'progress' ? { coalesceKey: String(rendition ?? 'overall') } : {}),
  };
}

function coalesceKey(event: UserEventFrame): string | undefined {
  switch (event.type) {
    case 'video.processing': {
      const { videoId, change } = event.payload;
      return change.kind === 'progress' ? `${videoId}:${change.rendition}` : undefined;
    }
    case 'preferences.updated':
    case 'captions.ready':
    case 'captions.failed':
    case 'notification.created':
    case 'notification.read':
    case 'comment.created':
      return undefined;
    default:
      return assertNever(event, 'UserEventFrame');
  }
}

export function userFrame(frame: UserEventFrame): SseFrame {
  const { id, ...event } = frame;
  const key = coalesceKey(frame);
  return { id, event: event.type, data: event, ...(key === undefined ? {} : { coalesceKey: key }) };
}

export function helloFrame(resume: StreamResume, unreadNotifications: number): SseFrame {
  return {
    event: 'hello',
    data: { type: 'hello', payload: { resume, unreadNotifications } },
  };
}
