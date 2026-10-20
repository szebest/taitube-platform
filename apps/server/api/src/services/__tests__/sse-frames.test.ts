import type { UserEventFrame } from '@vp/api-contracts';
import type { SseMessageEnvelope } from '@vp/events';
import { helloFrame, userFrame, videoFrame } from '../sse-frames';

const VIDEO_ID = '018f0000-0000-7000-8000-000000000020';

type Change = Extract<UserEventFrame, { type: 'video.processing' }>['payload']['change'];

function processing(change: Change, id?: number): UserEventFrame {
  return {
    ...(id === undefined ? {} : { id }),
    type: 'video.processing',
    payload: { videoId: VIDEO_ID, change },
  };
}

describe('apps/server/api/services: sse-frames', () => {
  it.each<[string, SseMessageEnvelope, string | undefined]>([
    ['progress, by rendition', { id: 3, event: 'progress', data: { rendition: '720p' } }, '720p'],
    ['progress with no rendition, as overall', { event: 'progress', data: {} }, 'overall'],
    ['a status, never', { id: 4, event: 'status', data: { status: 'READY' } }, undefined],
  ])('coalesces a video stream %s', (_label, envelope, coalesceKey) => {
    expect(videoFrame(envelope)).toEqual({
      id: envelope.id,
      event: envelope.event,
      data: envelope.data,
      ...(coalesceKey === undefined ? {} : { coalesceKey }),
    });
  });

  it.each<[string, Change, string | undefined]>([
    [
      'progress, by video and rendition',
      { kind: 'progress', rendition: '480p', percent: 10, overall: 5 },
      `${VIDEO_ID}:480p`,
    ],
    ['a status change, never', { kind: 'status', status: 'FAILED' }, undefined],
  ])('names a user event frame by its type and coalesces %s', (_label, change, coalesceKey) => {
    expect(userFrame(processing(change, 9))).toEqual({
      id: 9,
      event: 'video.processing',
      data: processing(change),
      ...(coalesceKey === undefined ? {} : { coalesceKey }),
    });
  });

  it('opens a user stream with an id-less hello', () => {
    expect(helloFrame('expired')).toEqual({
      event: 'hello',
      data: { type: 'hello', payload: { resume: 'expired' } },
    });
  });
});
