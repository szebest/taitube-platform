import { SCREENING_TRANSITIONS, type ScreeningTransitionName } from './screening';
import type { VideoStatus } from './status-vocabulary';

const DELETABLE = [
  'UPLOADING',
  'UPLOADED',
  'PROBING',
  'PROCESSING',
  'READY',
  'HELD',
  'FAILED',
  'REJECTED',
  'ABANDONED',
] as const;

const screening = <const N extends ScreeningTransitionName>(name: N) =>
  ({
    from: [SCREENING_TRANSITIONS[name].from],
    to: SCREENING_TRANSITIONS[name].to,
    event: SCREENING_TRANSITIONS[name].event,
  }) as const;

/**
 * Every edge of the video lifecycle and the `video_events` type it records. `VIDEO_LIFECYCLE` in
 * `@vp/domain-rules` is the machine over it; the table lives here so the repository port and the
 * job contracts can name an edge.
 */
export const VIDEO_LIFECYCLE_EDGES = {
  reject: { from: ['UPLOADING'], to: 'REJECTED', event: 'upload.rejected' },
  complete: { from: ['UPLOADING'], to: 'UPLOADED', event: 'upload.completed' },
  abort: { from: ['UPLOADING'], to: 'ABANDONED', event: 'upload.aborted' },
  abandon: { from: ['UPLOADING'], to: 'ABANDONED', event: 'video.abandoned' },
  startProbe: { from: ['UPLOADED'], to: 'PROBING', event: 'probe.started' },
  completeProbe: { from: ['PROBING'], to: 'PROCESSING', event: 'probe.completed' },
  failProbe: { from: ['PROBING'], to: 'FAILED', event: 'video.failed' },
  completeThumbnail: { from: ['PROCESSING'], to: 'PROCESSING', event: 'thumbnail.completed' },
  package: { from: ['PROCESSING'], to: 'READY', event: 'video.ready' },
  fail: { from: ['PROCESSING', 'PROBING'], to: 'FAILED', event: 'video.failed' },
  reconcileFail: { from: ['PROCESSING'], to: 'FAILED', event: 'video.failed' },
  reprocess: {
    from: ['READY', 'FAILED', 'PROCESSING'],
    to: 'PROBING',
    event: 'video.reprocessing',
  },
  delete: { from: DELETABLE, to: 'DELETED', event: 'video.deleted' },
  takedown: { from: DELETABLE, to: 'REJECTED', event: 'video.taken_down' },
  finalizeLive: { from: ['LIVE'], to: 'READY', event: 'video.ready' },
  failLive: { from: ['LIVE'], to: 'FAILED', event: 'video.failed' },
  hold: screening('hold'),
  approve: screening('approve'),
  rejectScreening: screening('reject'),
  appeal: screening('appeal'),
} as const satisfies Record<
  string,
  { from: readonly VideoStatus[]; to: VideoStatus; event: string }
>;

export type VideoLifecycleEdge = keyof typeof VIDEO_LIFECYCLE_EDGES;

/**
 * The first edge into `to` that leaves from every state in `from`, for a caller that still writes
 * the pair instead of naming its edge.
 */
export function videoLifecycleEdgeOf(
  from: VideoStatus | readonly VideoStatus[],
  to: VideoStatus
): VideoLifecycleEdge | undefined {
  const sources: readonly VideoStatus[] = [from].flat();
  return (Object.keys(VIDEO_LIFECYCLE_EDGES) as VideoLifecycleEdge[]).find((edge) => {
    const spec: { from: readonly VideoStatus[]; to: VideoStatus } = VIDEO_LIFECYCLE_EDGES[edge];
    return spec.to === to && sources.every((source) => spec.from.includes(source));
  });
}
