export interface BacklogItem {
  id: string;
  size: 'S' | 'M' | 'L';
  title: string;
  why: string;
}

export const BACKLOG: readonly BacklogItem[] = [
  {
    id: 'S9b',
    size: 'M',
    title: 'A child failure never reaches the package failure handler in production',
    why: "BullMQ fails a parent through `failParentOnFailure` inside Lua, so the worker never emits `failed` for it and the video waits for `reconcile-processing` (3 h). The in-memory queue calls the handler anyway, which is why the flow spec passes. The failure handler's package FAILED transition and the screening HELD path are also not fenced by generation, and `bullmq-processor.ts` keeps its own copy of the unknown-error attempt cap.",
  },
  {
    id: 'S1e',
    size: 'S',
    title: 'Remove the pair form of `transition`',
    why: 'The API and the screening repositories name an edge; the worker call sites in `failure-handler`, `probe*` and `reconcile-*` still write `from` and `to`, which resolve to the first matching edge.',
  },
  {
    id: 'S7b',
    size: 'M',
    title: 'Expired OPEN uploads and the COMPLETED upload with an UPLOADING video',
    why: 'An OPEN upload whose video left UPLOADING another way, or a crash between the two writes, has no recovery path. It needs a scan port on the upload repository.',
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
    id: 'C6, C13',
    size: 'M',
    title: 'Client status display reads one "watchable" concept',
    why: 'About 8 literal status comparisons in the studio, the web app and the embed route mean "watchable" or "processing". A named predicate in `@vp/domain-rules` replaces them, and the live pages follow. The stale progress tick on a READY video is fixed.',
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
];
