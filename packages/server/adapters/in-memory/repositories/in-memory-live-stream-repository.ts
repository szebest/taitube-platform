import type {
  EndLiveInput,
  EventRepository,
  GoLiveInput,
  LiveStreamPatch,
  LiveStreamRepositoryPort,
  LiveStreamSeed,
  OutboxRepository,
  UserEventRepository,
  VideoRepository,
} from '@vp/core/repositories';
import { type LiveStream, liveStreamCarryOver, videoStatusChanged } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { err, isErr, ok, type Result } from '@vp/result';

interface InMemoryLiveStreamRepositoryDeps {
  videos: VideoRepository;
  events: EventRepository;
  outbox: OutboxRepository;
  userEvents: UserEventRepository;
}

const copyOf = (stream: LiveStream): LiveStream => ({
  ...stream,
  markers: stream.markers.map((marker) => ({ ...marker })),
});

export class InMemoryLiveStreamRepository implements LiveStreamRepositoryPort {
  private readonly rows = new Map<string, LiveStream>();

  constructor(private readonly deps: InMemoryLiveStreamRepositoryDeps) {}

  async ensureIdle(
    channelId: string,
    seed: LiveStreamSeed
  ): Promise<Result<LiveStream, DatabaseUnavailable>> {
    const open = this.open(channelId);
    if (open) return ok(copyOf(open));

    const now = new Date();
    const stream: LiveStream = {
      ...seed,
      channelId,
      title: '',
      description: '',
      status: 'IDLE',
      visibility: 'public',
      archiveVisibility: 'public',
      currentViewers: 0,
      chatSlowModeSeconds: 0,
      chatSubscribersOnly: false,
      markers: [],
      startedAt: null,
      endedAt: null,
      videoId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(stream.id, stream);
    return ok(copyOf(stream));
  }

  async findById(id: string): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    return this.found((stream) => stream.id === id);
  }

  async findByKey(streamKey: string): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    return this.found((stream) => stream.streamKey === streamKey);
  }

  async findOpenByChannel(
    channelId: string
  ): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    const open = this.open(channelId);
    return ok(open ? copyOf(open) : null);
  }

  async findByVideoId(videoId: string): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    return this.found((stream) => stream.videoId === videoId);
  }

  async goLive(input: GoLiveInput): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    const { streamId, video, startedAt, outbox } = input;
    const stream = this.rows.get(streamId);
    if (stream?.status !== 'IDLE') return ok(null);

    const steps: (() => Promise<Result<unknown, DatabaseUnavailable>>)[] = [
      () => this.deps.videos.create({ ...video, status: 'LIVE' }),
      () =>
        this.deps.events.create({
          videoId: video.id,
          type: 'video.live',
          payload: { liveStreamId: streamId },
        }),
      ...outbox.map((row) => () => this.deps.outbox.enqueue(row)),
      () =>
        this.deps.userEvents.append({
          userId: video.ownerId,
          ...videoStatusChanged(video.id, 'LIVE'),
        }),
    ];
    for (const step of steps) {
      const done = await step();
      if (isErr(done)) return err(done.error);
    }

    Object.assign(stream, { status: 'LIVE', startedAt, videoId: video.id, updatedAt: startedAt });
    return ok(copyOf(stream));
  }

  async end(input: EndLiveInput): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    const { streamId, endedAt, nextId } = input;
    const stream = this.rows.get(streamId);
    if (stream?.status !== 'LIVE') return ok(stream?.status === 'ENDED' ? copyOf(stream) : null);

    const next: LiveStream = {
      ...stream,
      ...liveStreamCarryOver(stream),
      id: nextId,
      status: 'IDLE',
      currentViewers: 0,
      markers: [],
      startedAt: null,
      endedAt: null,
      videoId: null,
      createdAt: endedAt,
      updatedAt: endedAt,
    };
    Object.assign(stream, {
      status: 'ENDED',
      endedAt,
      streamKey: null,
      overlayToken: null,
      controlToken: null,
      updatedAt: endedAt,
    });
    this.rows.set(next.id, next);
    return ok(copyOf(stream));
  }

  async update(
    id: string,
    patch: LiveStreamPatch
  ): Promise<Result<LiveStream | null, DatabaseUnavailable>> {
    const stream = this.rows.get(id);
    if (!stream) return ok(null);
    Object.assign(stream, patch, { updatedAt: new Date() });
    return ok(copyOf(stream));
  }

  clear(): void {
    this.rows.clear();
  }

  private open(channelId: string): LiveStream | undefined {
    return [...this.rows.values()].find(
      (stream) => stream.channelId === channelId && stream.status !== 'ENDED'
    );
  }

  private found(
    match: (stream: LiveStream) => boolean
  ): Result<LiveStream | null, DatabaseUnavailable> {
    const stream = [...this.rows.values()].find(match);
    return ok(stream ? copyOf(stream) : null);
  }
}
