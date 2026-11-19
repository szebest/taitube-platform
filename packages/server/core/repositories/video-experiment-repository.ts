import type { Result } from '@kit/result';
import type {
  Experiment,
  ExperimentStatus,
  ExperimentVariantId,
  ExperimentVariantStats,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export type ExperimentCreated = 'created' | 'video-busy' | 'channel-full';

export interface ExperimentEnd {
  readonly status: Exclude<ExperimentStatus, 'running'>;
  readonly winnerVariantId: ExperimentVariantId | null;
  readonly at: Date;
}

export abstract class VideoExperimentRepository {
  /** Newest first. */
  abstract listFor(videoId: string): Promise<Result<Experiment[], DatabaseUnavailable>>;
  abstract find(
    videoId: string,
    experimentId: string
  ): Promise<Result<Experiment | null, DatabaseUnavailable>>;
  /** One batched read for a page of cards: the running test of each video that has one. */
  abstract runningFor(
    videoIds: readonly string[]
  ): Promise<Result<Map<string, Experiment>, DatabaseUnavailable>>;
  /** Running tests over every video of the owner. */
  abstract runningOnChannel(ownerId: string): Promise<Result<number, DatabaseUnavailable>>;
  /**
   * Inserts a running test unless its video already runs one or the owner runs `channelLimit`,
   * decided under one lock per owner with the insert.
   */
  abstract create(
    experiment: Experiment,
    ownerId: string,
    channelLimit: number
  ): Promise<Result<ExperimentCreated, DatabaseUnavailable>>;
  /** The ended test, or `null` when it was not running: two enders cannot both win. */
  abstract end(
    videoId: string,
    experimentId: string,
    end: ExperimentEnd
  ): Promise<Result<Experiment | null, DatabaseUnavailable>>;
  /** One row per variant and day; every id gets an entry. */
  abstract statsFor(
    experimentIds: readonly string[]
  ): Promise<Result<Map<string, ExperimentVariantStats[]>, DatabaseUnavailable>>;
}
