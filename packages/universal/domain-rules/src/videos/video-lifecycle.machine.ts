import { SCREENING_TRANSITIONS, type ScreeningTransitionName, VIDEO_STATUSES } from '@vp/domain';
import { defineMachine } from '@vp/machine';

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

export const VIDEO_LIFECYCLE = defineMachine({
  name: 'video-lifecycle',
  states: VIDEO_STATUSES,
  initial: ['UPLOADING', 'LIVE'],
  final: ['DELETED'],
  events: {
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
  },
});
