import type { VideoSummary } from '@vp/api-contracts';
import { videoSummary } from '@vp/web-testing';

const idOf = (position: number) =>
  `0190c3a0-5e1d-7000-8000-00000000f${String(position).padStart(3, '0')}`;

/** The `position`th Short of a feed, ready to play, with its own id, title and poster. */
export function shortSummary(
  position: number,
  overrides: Partial<VideoSummary> = {}
): VideoSummary {
  return videoSummary({
    id: idOf(position),
    title: `Short ${position}`,
    format: 'short',
    likesCount: 24,
    playbackUrl: `http://localhost:9000/hls/${position}/master.m3u8`,
    posterUrl: `http://localhost:9000/posters/${position}.jpg`,
    ...overrides,
  });
}

export const SHORTS = [1, 2, 3, 4].map((position) => shortSummary(position));
