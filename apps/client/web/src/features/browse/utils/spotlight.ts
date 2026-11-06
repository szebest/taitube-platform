import type { CurrentPickView, VideoSummary } from '@vp/api-contracts';

/** What the home spotlight shows; a fallback has no note and no window to read. */
export type Spotlight =
  | { source: 'scheduled'; video: VideoSummary; note: string | null; endsAt: string }
  | { source: 'fallback'; video: VideoSummary };

export function spotlightOf(view: CurrentPickView): Spotlight {
  if (view.source === 'scheduled' && view.endsAt !== null) {
    return { source: 'scheduled', video: view.video, note: view.note, endsAt: view.endsAt };
  }
  return { source: 'fallback', video: view.video };
}
