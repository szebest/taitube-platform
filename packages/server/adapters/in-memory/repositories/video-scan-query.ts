import { assertNever } from '@kit/result';
import type {
  ProcessingStepRecord,
  VideoEventRecord,
  VideoRecord,
  VideoScan,
  VideoScanAbsence,
} from '@vp/core/repositories';

/** The per-video history a scan's `without` reads. */
export interface VideoScanHistory {
  steps(videoId: string): Promise<ProcessingStepRecord[]>;
  events(videoId: string): Promise<VideoEventRecord[]>;
}

async function isAbsent(
  video: VideoRecord,
  absence: VideoScanAbsence,
  history: VideoScanHistory
): Promise<boolean> {
  switch (absence.type) {
    case 'step': {
      const steps = await history.steps(video.id);
      return !steps.some(({ step }) => step === absence.step);
    }
    case 'event': {
      const events = await history.events(video.id);
      return !events.some(
        ({ type, payload }) =>
          type === absence.event &&
          (!absence.forCurrentGeneration ||
            Number((payload as { generation?: number })?.generation ?? 0) >= video.generation)
      );
    }
    default:
      return assertNever(absence, 'VideoScanAbsence');
  }
}

/** What `VideoRepository.scan` answers over `videos` at `nowMs`, copies in iteration order. */
export async function selectVideoScan(
  videos: Iterable<VideoRecord>,
  filter: VideoScan,
  nowMs: number,
  history: VideoScanHistory
): Promise<VideoRecord[]> {
  const { status, minGeneration, without, limit } = filter;
  const idle = filter.idleFor && {
    since: filter.idleFor.since,
    before: new Date(nowMs - filter.idleFor.ms),
  };
  const results: VideoRecord[] = [];

  for (const video of videos) {
    if (results.length >= limit) break;
    if (video.status !== status) continue;
    if (idle && (video[idle.since] ?? video.updatedAt) >= idle.before) continue;
    if (minGeneration !== undefined && video.generation < minGeneration) continue;
    if (without && !(await isAbsent(video, without, history))) continue;
    results.push({ ...video });
  }

  return results;
}
