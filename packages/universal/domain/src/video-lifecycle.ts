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
  reconcileFail: { from: ['PROBING', 'PROCESSING'], to: 'FAILED', event: 'video.failed' },
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
 * A status change named by its edge, or by the `from` to `to` pair a caller that has not named its
 * edge still writes; the pair resolves to the first edge into `to` that leaves every state in `from`.
 */
export type VideoTransitionTarget =
  | { edge: VideoLifecycleEdge }
  | {
      edge?: undefined;
      from: VideoStatus | readonly VideoStatus[];
      to: VideoStatus;
      eventType: string;
    };

interface ResolvedVideoTransition {
  edge: VideoLifecycleEdge | undefined;
  from: readonly VideoStatus[];
  to: VideoStatus;
  event: string;
}

const EDGE_NAMES = Object.keys(VIDEO_LIFECYCLE_EDGES) as VideoLifecycleEdge[];

export function resolveVideoTransition(target: VideoTransitionTarget): ResolvedVideoTransition {
  if (target.edge !== undefined) {
    const { from, to, event }: { from: readonly VideoStatus[]; to: VideoStatus; event: string } =
      VIDEO_LIFECYCLE_EDGES[target.edge];
    return { edge: target.edge, from, to, event };
  }

  const from: readonly VideoStatus[] = [target.from].flat();
  const edge = EDGE_NAMES.find((name) => {
    const spec: { from: readonly VideoStatus[]; to: VideoStatus } = VIDEO_LIFECYCLE_EDGES[name];
    return spec.to === target.to && from.every((source) => spec.from.includes(source));
  });
  return { edge, from, to: target.to, event: target.eventType };
}
