import { isErr, ok, type Result } from '@kit/result';
import {
  type NewOutboxInput,
  type OpenReplacementInput,
  type OutboxRepository,
  type SaveEditInput,
  type SwapGenerationInput,
  type SwapOutcome,
  VideoGenerationRepository,
} from '@vp/core/repositories';
import { type VideoEdit, type VideoGeneration, videoGenerationUpdated } from '@vp/domain';
import { IN_FLIGHT_GENERATIONS, VIDEO_GENERATION } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Clock, realClock } from './clock';
import {
  type StoredGeneration,
  type SwapStores,
  generationKey,
  swapInMemory,
  toGenerationRecord,
} from './in-memory-generation-swap';

export interface InMemoryVideoGenerationDeps extends Omit<SwapStores, 'generations' | 'edits'> {
  outbox: Pick<OutboxRepository, 'enqueue'>;
}

const inState = (row: StoredGeneration | undefined, event: 'render' | 'swap' | 'purge') =>
  row !== undefined && VIDEO_GENERATION.sources(event).includes(row.status);

export class InMemoryVideoGenerationRepository extends VideoGenerationRepository {
  private readonly generations = new Map<string, StoredGeneration>();
  private readonly edits = new Map<string, VideoEdit>();

  constructor(
    private readonly deps: InMemoryVideoGenerationDeps,
    private readonly now: Clock = realClock
  ) {
    super();
  }

  private ofVideo(videoId: string) {
    return [...this.generations.values()].filter((row) => row.videoId === videoId);
  }

  private open(
    row: Omit<
      VideoGeneration,
      | 'createdAt'
      | 'updatedAt'
      | 'playback'
      | 'timeline'
      | 'retention'
      | 'needsReview'
      | 'errorCode'
    >
  ): boolean {
    const taken =
      this.generations.has(generationKey(row.videoId, row.generation)) ||
      this.ofVideo(row.videoId).some(({ status }) => IN_FLIGHT_GENERATIONS.includes(status));
    if (taken) return false;
    const at = new Date(this.now());
    this.generations.set(generationKey(row.videoId, row.generation), {
      ...row,
      playback: null,
      timeline: null,
      retention: null,
      needsReview: false,
      errorCode: null,
      lockToken: null,
      createdAt: at,
      updatedAt: at,
    });
    return true;
  }

  async list(videoId: string): Promise<Result<VideoGeneration[], DatabaseUnavailable>> {
    return ok(
      this.ofVideo(videoId)
        .sort((a, b) => b.generation - a.generation)
        .map(toGenerationRecord)
    );
  }

  async findEdit(videoId: string): Promise<Result<VideoEdit | null, DatabaseUnavailable>> {
    const edit = this.edits.get(videoId);
    return ok(edit ? { ...edit } : null);
  }

  async openReplacement(
    input: OpenReplacementInput
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return ok(
      this.open({
        videoId: input.videoId,
        generation: input.generation,
        kind: 'replacement',
        status: 'uploading',
        sourceKey: input.sourceKey,
        baseGeneration: null,
        replacesGeneration: input.replacesGeneration,
        purgeAfter: input.uploadExpiresAt,
      })
    );
  }

  async startRender(
    videoId: string,
    generation: number,
    outbox: NewOutboxInput
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const row = this.generations.get(generationKey(videoId, generation));
    if (!row || !inState(row, 'render')) return ok(false);
    const enqueued = await this.deps.outbox.enqueue(outbox);
    if (isErr(enqueued)) return enqueued;
    Object.assign(row, { status: 'rendering', purgeAfter: null, updatedAt: new Date(this.now()) });
    return ok(true);
  }

  async saveEdit(input: SaveEditInput): Promise<Result<boolean, DatabaseUnavailable>> {
    const { videoId, generation, baseGeneration } = input;
    const opened = this.open({
      videoId,
      generation,
      kind: 'edit',
      status: 'rendering',
      sourceKey: null,
      baseGeneration,
      replacesGeneration: input.replacesGeneration,
      purgeAfter: null,
    });
    if (!opened) return ok(false);
    const enqueued = await this.deps.outbox.enqueue(input.outbox);
    if (isErr(enqueued)) return enqueued;
    this.edits.set(videoId, {
      ...input.edit,
      videoId,
      baseGeneration,
      generation,
      status: 'rendering',
      updatedAt: new Date(this.now()),
    });
    return ok(true);
  }

  async claim(
    videoId: string,
    generation: number,
    lockToken: string
  ): Promise<Result<VideoGeneration | null, DatabaseUnavailable>> {
    const row = this.generations.get(generationKey(videoId, generation));
    if (!row || !inState(row, 'swap')) return ok(null);
    row.lockToken = lockToken;
    return ok(toGenerationRecord(row));
  }

  async swap(input: SwapGenerationInput): Promise<Result<SwapOutcome, DatabaseUnavailable>> {
    return swapInMemory({ ...this.deps, generations: this.generations, edits: this.edits }, input);
  }

  async fail(
    videoId: string,
    generation: number,
    errorCode: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const row = this.generations.get(generationKey(videoId, generation));
    if (!row || !IN_FLIGHT_GENERATIONS.includes(row.status)) return ok(false);
    const at = new Date(this.now());
    Object.assign(row, {
      status: 'failed',
      errorCode,
      lockToken: null,
      purgeAfter: null,
      updatedAt: at,
    });
    const edit = this.edits.get(videoId);
    if (edit?.generation === generation) Object.assign(edit, { status: 'failed', updatedAt: at });
    const owner = this.deps.videos.getAllVideos().find(({ id }) => id === videoId)?.ownerId;
    if (!owner) return ok(true);
    const announced = await this.deps.userEvents.append({
      userId: owner,
      ...videoGenerationUpdated({ videoId, generation, status: 'failed' }),
    });
    return isErr(announced) ? announced : ok(true);
  }

  async listDue(now: Date, limit: number): Promise<Result<VideoGeneration[], DatabaseUnavailable>> {
    return ok(
      [...this.generations.values()]
        .filter(
          (row) =>
            row.purgeAfter !== null &&
            row.purgeAfter < now &&
            (inState(row, 'purge') || inState(row, 'render'))
        )
        .sort((a, b) => (a.purgeAfter?.getTime() ?? 0) - (b.purgeAfter?.getTime() ?? 0))
        .slice(0, limit)
        .map(toGenerationRecord)
    );
  }

  async markPurged(
    videoId: string,
    generation: number
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const row = this.generations.get(generationKey(videoId, generation));
    if (!row || !inState(row, 'purge')) return ok(false);
    const at = new Date(this.now());
    Object.assign(row, {
      status: 'purged',
      purgeAfter: null,
      playback: null,
      timeline: null,
      updatedAt: at,
    });
    const edit = this.edits.get(videoId);
    const playing = this.deps.videos.getAllVideos().find(({ id }) => id === videoId);
    if (edit?.baseGeneration === generation && playing) {
      Object.assign(edit, {
        baseGeneration: playing.generation,
        trim: null,
        blurs: [],
        updatedAt: at,
      });
    }
    return ok(true);
  }

  clear(): void {
    this.generations.clear();
    this.edits.clear();
  }
}
