import type { CaptionKind } from './captions';
import type { PreferenceSection } from './settings';
import type { VideoStatus } from './status-vocabulary';

type VideoProcessingChange =
  | { kind: 'status'; status: VideoStatus }
  | { kind: 'progress'; rendition: string; percent: number; overall: number };

/** What one signed-in person is told on `GET /v1/me/events`; `@vp/api-contracts` validates it. */
export type UserEvent =
  | { type: 'video.processing'; payload: { videoId: string; change: VideoProcessingChange } }
  | { type: 'preferences.updated'; payload: { sections: PreferenceSection[]; version: number } }
  | {
      type: 'captions.ready';
      payload: { videoId: string; track: { id: string; language: string; kind: CaptionKind } };
    }
  | { type: 'captions.failed'; payload: { videoId: string; captionId: string; reason: string } };

export function videoStatusChanged(videoId: string, status: VideoStatus): UserEvent {
  return { type: 'video.processing', payload: { videoId, change: { kind: 'status', status } } };
}

export function preferencesUpdated(sections: PreferenceSection[], version: number): UserEvent {
  return { type: 'preferences.updated', payload: { sections, version } };
}

export function captionsReady(
  videoId: string,
  track: { id: string; language: string; kind: CaptionKind }
): UserEvent {
  return { type: 'captions.ready', payload: { videoId, track } };
}

export function captionsFailed(videoId: string, captionId: string, reason: string): UserEvent {
  return { type: 'captions.failed', payload: { videoId, captionId, reason } };
}
