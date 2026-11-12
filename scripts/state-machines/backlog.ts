export interface BacklogItem {
  id: string;
  size: 'S' | 'M' | 'L';
  title: string;
  why: string;
}

/** Ranked by value over cost. Lines marked PLAUSIBLE come from reading the code and need an integration run first. */
export const BACKLOG: readonly BacklogItem[] = [
  {
    id: 'S1b',
    size: 'M',
    title: 'Video lifecycle, typed edges',
    why: '`TransitionVideoOptions` takes an edge name instead of from and to. The takedown path goes through `commitVideoTransition`, so it emits the user event and the notifications. `transitionNotificationJobs` and `mapEventToSse` become total over the machine.',
  },
  {
    id: 'S1d',
    size: 'S',
    title: 'Edge check in the in-memory video repository',
    why: '`transition` in the in-memory double would reject a pair that is not an edge of `VIDEO_LIFECYCLE`, giving every service and worker spec the check for free. Three worker specs (`captions-audio`, `dlq-stage-failures`, `purge-deleted`) seed a video in a state the pipeline would not have reached (UPLOADED then PROCESSING or READY, LIVE then DELETED), so their fixtures change first.',
  },
  {
    id: 'S9',
    size: 'M',
    title: 'Failure handler final-attempt gate',
    why: 'PLAUSIBLE: a transient package failure marks the video FAILED while BullMQ still retries. Confirm with a BullMQ integration spec, then fix. The DLQ vocabulary (PARKED, REPLAYED, DISCARDED) is spelled three times and becomes one machine.',
  },
  {
    id: 'S1c, S8',
    size: 'M',
    title: 'Reprocess correctness',
    why: 'PLAUSIBLE: a reprocess of a READY video gets stuck in PROBING, because a DONE step fences the new probe. Needs a generation check in the worker CAS, a step reset on reprocess, and reconcilers for PROBING and LIVE.',
  },
  {
    id: 'C5',
    size: 'M',
    title: 'Upload dock machine',
    why: 'Per-item phases, cancel by item id (today it aborts the latest upload), and a server abort when completion fails.',
  },
  {
    id: 'C2, C3, C7',
    size: 'L',
    title: 'One reconnecting-socket machine and a `useMachine` hook',
    why: 'Fixes the live chat retry reset (it resets on `open`, not on `hello`) once, and exposes a "stream down" state to the status badge, the live pages and the notifications bell.',
  },
  {
    id: 'S7',
    size: 'S',
    title: 'Upload session CAS',
    why: '`updateStatus` has no compare-and-set, so a racing write can flip ABORTED to COMPLETED. The window between a COMPLETED upload and an UPLOADING video is a separate, larger item.',
  },
  {
    id: 'S12, S13',
    size: 'M',
    title: 'Watch-party room phase',
    why: 'Drop the duplicated `phase`, give a closed room a phase, make the clock exhaustive. Then the two socket booleans on the server.',
  },
  {
    id: 'S14',
    size: 'M',
    title: 'SSE connection booleans to one union',
    why: 'Five booleans give 32 combinations for about 8 real states. Timers are involved, so it needs its own plan.',
  },
  {
    id: 'S10',
    size: 'S',
    title: 'Outbox dead state and a transactional claim',
    why: 'A poison row loops forever, and `claimBatch` holds its lock outside any transaction.',
  },
  {
    id: 'C6, C13',
    size: 'S',
    title: 'Client status display reads the machine',
    why: 'About 8 literal status comparisons in the studio, the web app and the embed route become table reads; the live pages follow.',
  },
  {
    id: 'C11, C17, C18',
    size: 'S',
    title: 'Composer, settings sections, table state',
    why: 'The `saved = isSuccess && !dirty` idiom is repeated 7 times, and `fetching = isFetching && !isPending` in 7 tables.',
  },
  {
    id: 'C9, C10, C1, C8',
    size: 'L',
    title: 'Replay intent, PWA, preferences merge, playback host',
    why: 'High blast radius, 12 or more files each, and their specs overlap the flaky-spec work.',
  },
  {
    id: 'S15, S16, S6b, S17, S19, S20',
    size: 'S',
    title:
      'Captions, channel images, live stream DB edges, circuit breaker, API shutdown phase, demo plan',
    why: 'The circuit breaker half-open state admits every caller instead of one trial call. The API shutdown phase is never set to `stopping`. The demo `--dry-run` plan is a hand-written copy of the step list.',
  },
];
