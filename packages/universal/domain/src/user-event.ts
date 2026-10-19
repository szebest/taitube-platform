import type { VideoStatus } from './status-vocabulary';

type VideoProcessingChange =
  | { kind: 'status'; status: VideoStatus }
  | { kind: 'progress'; rendition: string; percent: number; overall: number };

/** What one signed-in person is told on `GET /v1/me/events`; `@vp/api-contracts` validates it. */
export type UserEvent = {
  type: 'video.processing';
  payload: { videoId: string; change: VideoProcessingChange };
};

export function videoStatusChanged(videoId: string, status: VideoStatus): UserEvent {
  return { type: 'video.processing', payload: { videoId, change: { kind: 'status', status } } };
}
