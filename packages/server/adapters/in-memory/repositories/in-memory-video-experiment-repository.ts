import { ok, type Result } from '@kit/result';
import {
  type ExperimentCreated,
  type ExperimentEnd,
  VideoExperimentRepository,
} from '@vp/core/repositories';
import {
  type Experiment,
  type ExperimentCount,
  type ExperimentVariantStats,
  mergeExperimentCounts,
} from '@vp/domain';
import { EXPERIMENT } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';

/** The owner of every video, which is what a channel's running tests are counted over. */
export interface ExperimentVideos {
  getAllVideos(): readonly { id: string; ownerId: string }[];
}

export class InMemoryVideoExperimentRepository extends VideoExperimentRepository {
  private readonly experiments = new Map<string, Experiment>();
  private readonly stats = new Map<string, ExperimentCount>();

  constructor(private readonly videos: ExperimentVideos) {
    super();
  }

  async listFor(videoId: string): Promise<Result<Experiment[], DatabaseUnavailable>> {
    return ok(
      [...this.experiments.values()]
        .filter((experiment) => experiment.videoId === videoId)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || b.id.localeCompare(a.id))
        .map((experiment) => structuredClone(experiment))
    );
  }

  async find(
    videoId: string,
    experimentId: string
  ): Promise<Result<Experiment | null, DatabaseUnavailable>> {
    const found = this.experiments.get(experimentId);
    return ok(found?.videoId === videoId ? structuredClone(found) : null);
  }

  async runningFor(
    videoIds: readonly string[]
  ): Promise<Result<Map<string, Experiment>, DatabaseUnavailable>> {
    const wanted = new Set(videoIds);
    const running = new Map<string, Experiment>();
    for (const experiment of this.running()) {
      if (wanted.has(experiment.videoId)) {
        running.set(experiment.videoId, structuredClone(experiment));
      }
    }
    return ok(running);
  }

  async runningOnChannel(ownerId: string): Promise<Result<number, DatabaseUnavailable>> {
    return ok(this.runningOwnedBy(ownerId));
  }

  async create(
    experiment: Experiment,
    ownerId: string,
    channelLimit: number
  ): Promise<Result<ExperimentCreated, DatabaseUnavailable>> {
    if (this.running().some((held) => held.videoId === experiment.videoId)) {
      return ok('video-busy');
    }
    if (this.runningOwnedBy(ownerId) >= channelLimit) return ok('channel-full');
    this.experiments.set(experiment.id, structuredClone(experiment));
    return ok('created');
  }

  async end(
    videoId: string,
    experimentId: string,
    end: ExperimentEnd
  ): Promise<Result<Experiment | null, DatabaseUnavailable>> {
    const found = this.experiments.get(experimentId);
    if (found?.videoId !== videoId || !EXPERIMENT.hasEdge(found.status, end.status))
      return ok(null);
    const ended: Experiment = {
      ...found,
      status: end.status,
      winnerVariantId: end.winnerVariantId,
      endedAt: end.at,
    };
    this.experiments.set(experimentId, ended);
    return ok(structuredClone(ended));
  }

  async statsFor(
    experimentIds: readonly string[]
  ): Promise<Result<Map<string, ExperimentVariantStats[]>, DatabaseUnavailable>> {
    const stats = new Map<string, ExperimentVariantStats[]>(experimentIds.map((id) => [id, []]));
    const rows = [...this.stats.values()].sort(
      (a, b) => a.variantId.localeCompare(b.variantId) || a.viewDate.localeCompare(b.viewDate)
    );
    for (const { experimentId, variantId, impressions, starts, watchSeconds } of rows) {
      stats.get(experimentId)?.push({ variantId, impressions, starts, watchSeconds });
    }
    return ok(stats);
  }

  /** What a flush adds to `video_experiment_stats`; a test that is not here is skipped, as its foreign key does. */
  addStats(counts: readonly ExperimentCount[]): void {
    for (const count of mergeExperimentCounts(counts)) {
      if (!this.experiments.has(count.experimentId)) continue;
      const key = `${count.experimentId}|${count.variantId}|${count.viewDate}`;
      const held = this.stats.get(key);
      this.stats.set(key, {
        ...count,
        impressions: count.impressions + (held?.impressions ?? 0),
        starts: count.starts + (held?.starts ?? 0),
        watchSeconds: count.watchSeconds + (held?.watchSeconds ?? 0),
      });
    }
  }

  clear(): void {
    this.experiments.clear();
    this.stats.clear();
  }

  private running(): Experiment[] {
    return [...this.experiments.values()].filter(({ status }) => status === 'running');
  }

  private runningOwnedBy(ownerId: string): number {
    const owned = new Set(
      this.videos
        .getAllVideos()
        .filter((video) => video.ownerId === ownerId)
        .map(({ id }) => id)
    );
    return this.running().filter(({ videoId }) => owned.has(videoId)).length;
  }
}
