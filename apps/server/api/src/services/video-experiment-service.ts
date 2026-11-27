import { type Result, assertNever, err, isErr, map, ok } from '@kit/result';
import type { ExperimentView } from '@vp/api-contracts';
import type { VideoExperimentRepository, VideoRepository } from '@vp/core/repositories';
import {
  type Experiment,
  type ExperimentVariantId,
  type ExperimentVariantStats,
  MAX_RUNNING_EXPERIMENTS_PER_CHANNEL,
  experimentResults,
} from '@vp/domain';
import {
  type ExperimentInput,
  type ExperimentLimit,
  type ExperimentNotFound,
  type ExperimentNotRunning,
  type InvalidExperiment,
  decideExperiment,
  decideExperimentApply,
  decideExperimentStop,
  experimentLimit,
  experimentNotFound,
  experimentNotRunning,
} from '@vp/domain-rules';
import { type DatabaseUnavailable, ErrorCodes } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import type { CreatorStudioService } from './creator-studio-service';
import { isoOf } from './cursor';
import type { UpdateVideoServiceFailure } from './video-edit';
import { type EditAccessFailure, editableVideo } from './video-edit-access';
import type { VideoDetailView } from './video-views';

export interface VideoExperimentServiceDeps {
  videos: VideoRepository;
  experiments: VideoExperimentRepository;
  studio: CreatorStudioService;
  newId: () => string;
  now: () => number;
}

export type CreateExperimentFailure = EditAccessFailure | InvalidExperiment | ExperimentLimit;
export type StopExperimentFailure = EditAccessFailure | ExperimentNotFound | ExperimentNotRunning;
export type ApplyExperimentFailure =
  | StopExperimentFailure
  | InvalidExperiment
  | UpdateVideoServiceFailure;

function toExperimentView(
  experiment: Experiment,
  stats: readonly ExperimentVariantStats[]
): ExperimentView {
  const results = experimentResults(experiment.variants, stats);
  return {
    id: experiment.id,
    videoId: experiment.videoId,
    kind: experiment.kind,
    variants: experiment.variants.map((variant) => ({ ...variant })),
    status: experiment.status,
    startedAt: isoOf(experiment.startedAt),
    endedAt: experiment.endedAt === null ? null : isoOf(experiment.endedAt),
    winnerVariantId: experiment.winnerVariantId,
    results: { enoughData: results.enoughData, variants: [...results.variants] },
  };
}

/**
 * Title and thumbnail tests, for whoever may edit the video. The numbers are reported and the
 * creator applies a winner through the normal edit; nothing here picks one on its own.
 */
export class VideoExperimentService {
  constructor(private readonly deps: VideoExperimentServiceDeps) {}

  async list(
    user: UserContext,
    videoId: string
  ): Promise<Result<{ items: ExperimentView[] }, EditAccessFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;

    const experiments = await this.deps.experiments.listFor(videoId);
    if (isErr(experiments)) return experiments;
    const stats = await this.deps.experiments.statsFor(experiments.value.map(({ id }) => id));
    return map(stats, (of) => ({
      items: experiments.value.map((experiment) =>
        toExperimentView(experiment, of.get(experiment.id) ?? [])
      ),
    }));
  }

  async create(
    user: UserContext,
    videoId: string,
    input: ExperimentInput
  ): Promise<Result<ExperimentView, CreateExperimentFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;
    const { ownerId } = video.value;

    const runningOnVideo = await this.deps.experiments.runningFor([videoId]);
    if (isErr(runningOnVideo)) return runningOnVideo;
    const runningOnChannel = await this.deps.experiments.runningOnChannel(ownerId);
    if (isErr(runningOnChannel)) return runningOnChannel;
    const variants = decideExperiment(input, {
      video: video.value,
      runningOnVideo: runningOnVideo.value.has(videoId),
      runningOnChannel: runningOnChannel.value,
    });
    if (isErr(variants)) return variants;

    const experiment: Experiment = {
      id: this.deps.newId(),
      videoId,
      kind: input.kind,
      variants: variants.value,
      status: 'running',
      startedAt: new Date(this.deps.now()),
      endedAt: null,
      winnerVariantId: null,
    };
    const created = await this.deps.experiments.create(
      experiment,
      ownerId,
      MAX_RUNNING_EXPERIMENTS_PER_CHANNEL
    );
    if (isErr(created)) return created;
    switch (created.value) {
      case 'created':
        return ok(toExperimentView(experiment, []));
      case 'video-busy':
        return err(experimentLimit(videoId, 'video'));
      case 'channel-full':
        return err(experimentLimit(videoId, 'channel'));
      default:
        return assertNever(created.value, 'ExperimentCreated');
    }
  }

  async stop(
    user: UserContext,
    videoId: string,
    experimentId: string
  ): Promise<Result<ExperimentView, StopExperimentFailure>> {
    const running = await this.running(user, videoId, experimentId);
    if (isErr(running)) return running;
    const stopped = decideExperimentStop(running.value);
    if (isErr(stopped)) return stopped;

    const ended = await this.end(videoId, experimentId, null);
    if (isErr(ended)) return ended;
    const stats = await this.deps.experiments.statsFor([experimentId]);
    return map(stats, (of) => toExperimentView(ended.value, of.get(experimentId) ?? []));
  }

  /**
   * Writes the winner under the caller's version, then finishes the test. A stale version changes
   * nothing. Losing `end` to a concurrent stop or apply still answers the written video: the edit
   * the creator asked for landed under their version, and the test is over either way.
   */
  async apply(
    user: UserContext,
    videoId: string,
    experimentId: string,
    choice: { variantId: ExperimentVariantId; version: number }
  ): Promise<Result<VideoDetailView, ApplyExperimentFailure>> {
    const running = await this.running(user, videoId, experimentId);
    if (isErr(running)) return running;
    const winner = decideExperimentApply(running.value, choice.variantId);
    if (isErr(winner)) return winner;

    const { title, thumbnail } = winner.value;
    const written = await this.deps.studio.update(user, videoId, {
      ...(title === null ? {} : { title }),
      ...(thumbnail === null ? {} : { selectedThumbnail: thumbnail }),
      version: choice.version,
    });
    if (isErr(written)) return written;

    const ended = await this.end(videoId, experimentId, winner.value.id);
    if (isErr(ended) && ended.error.code === ErrorCodes.DATABASE_UNAVAILABLE) return ended;
    return written;
  }

  private async running(
    user: UserContext,
    videoId: string,
    experimentId: string
  ): Promise<Result<Experiment, EditAccessFailure | ExperimentNotFound>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;
    const found = await this.deps.experiments.find(videoId, experimentId);
    if (isErr(found)) return found;
    return found.value ? ok(found.value) : err(experimentNotFound(experimentId));
  }

  private async end(
    videoId: string,
    experimentId: string,
    winnerVariantId: ExperimentVariantId | null
  ): Promise<Result<Experiment, ExperimentNotRunning | DatabaseUnavailable>> {
    const ended = await this.deps.experiments.end(videoId, experimentId, {
      status: winnerVariantId === null ? 'stopped' : 'finished',
      winnerVariantId,
      at: new Date(this.deps.now()),
    });
    if (isErr(ended)) return ended;
    return ended.value ? ok(ended.value) : err(experimentNotRunning(experimentId));
  }
}
