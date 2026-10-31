import type { CurrentPickView, PickView } from '@vp/api-contracts';
import type { EditorPickEntry } from '@vp/domain';
import type { CdnBase } from '@vp/env-schema';
import { type SpriteGeometry, toVideoSummaryView, type VideoSummaryView } from './video-views';

export function toPickView(
  { pick, video, channel }: EditorPickEntry,
  cdn: CdnBase,
  sprite: SpriteGeometry
): PickView {
  return {
    ...pick,
    startsAt: pick.startsAt.toISOString(),
    endsAt: pick.endsAt.toISOString(),
    createdAt: pick.createdAt.toISOString(),
    video: toVideoSummaryView(video, cdn, sprite, channel),
  };
}

export function toScheduledView(
  { pick, video, channel }: EditorPickEntry,
  cdn: CdnBase,
  sprite: SpriteGeometry
): CurrentPickView {
  return {
    source: 'scheduled',
    video: toVideoSummaryView(video, cdn, sprite, channel),
    note: pick.note,
    startsAt: pick.startsAt.toISOString(),
    endsAt: pick.endsAt.toISOString(),
  };
}

export function toFallbackView(video: VideoSummaryView): CurrentPickView {
  return { source: 'fallback', video, note: null, startsAt: null, endsAt: null };
}
