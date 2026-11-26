import { type Result, err, isErr, ok } from '@kit/result';
import type { VideoGenerationRepository, VideoRepository } from '@vp/core/repositories';
import {
  type Video,
  type VideoEdit,
  type VideoEditList,
  type VideoGeneration,
  nextGeneration,
} from '@vp/domain';
import {
  type GenerationInProgress,
  type GenerationStartFailure,
  type InvalidVideoEdit,
  type NoEditToRevert,
  decideEditBase,
  decideEditRevert,
  decideGenerationStart,
  decideVideoEdit,
  generationInProgress,
  invalidVideoEdit,
  noEditToRevert,
} from '@vp/domain-rules';
import { type VersionConflict, versionConflict } from '@vp/errors';
import { applyEditsOutbox } from '@vp/job-contracts';
import type { UserContext } from '@vp/permissions';
import { isoOf } from './cursor';
import { type EditAccessFailure, editableVideo } from './video-edit-access';

export interface VideoEditsServiceDeps {
  videos: VideoRepository;
  generations: VideoGenerationRepository;
  traceparent: () => string;
  now: () => number;
}

export interface VideoEditView extends VideoEditList {
  baseGeneration: number;
  generation: number;
  status: VideoEdit['status'];
  updatedAt: string;
}

export interface VideoGenerationsView {
  activeGeneration: number;
  editBase: { generation: number; durationMs: number };
  edit: VideoEditView | null;
  items: {
    generation: number;
    kind: VideoGeneration['kind'];
    status: VideoGeneration['status'];
    durationMs: number | null;
    needsReview: boolean;
    errorCode: string | null;
    purgeAfter: string | null;
    createdAt: string;
  }[];
}

export type SaveEditFailure =
  | EditAccessFailure
  | InvalidVideoEdit
  | GenerationStartFailure
  | GenerationInProgress;
export type RevertEditFailure = EditAccessFailure | NoEditToRevert | VersionConflict;

const toEditView = (edit: VideoEdit): VideoEditView => ({
  trim: edit.trim,
  blurs: edit.blurs,
  baseGeneration: edit.baseGeneration,
  generation: edit.generation,
  status: edit.status,
  updatedAt: isoOf(edit.updatedAt),
});

interface EditContext {
  video: Video;
  edit: VideoEdit | null;
  generations: VideoGeneration[];
  base: number;
  baseDurationMs: number | null;
}

/** Trim and blur over a base generation, rendered into a new one, and the way back to the base. */
export class VideoEditsService {
  constructor(private readonly deps: VideoEditsServiceDeps) {}

  private async context(
    user: UserContext,
    videoId: string
  ): Promise<Result<EditContext, EditAccessFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;
    const generations = await this.deps.generations.list(videoId);
    if (isErr(generations)) return generations;
    const edit = await this.deps.generations.findEdit(videoId);
    if (isErr(edit)) return edit;
    const base = decideEditBase(video.value, edit.value, generations.value);
    const baseDurationMs =
      base === video.value.generation
        ? video.value.durationMs
        : (generations.value.find(({ generation }) => generation === base)?.playback?.durationMs ??
          null);
    return ok({
      video: video.value,
      edit: edit.value,
      generations: generations.value,
      base,
      baseDurationMs,
    });
  }

  async generations(
    user: UserContext,
    videoId: string
  ): Promise<Result<VideoGenerationsView, EditAccessFailure>> {
    const found = await this.context(user, videoId);
    if (isErr(found)) return found;
    const { video, edit, generations, base, baseDurationMs } = found.value;
    return ok({
      activeGeneration: video.generation,
      editBase: { generation: base, durationMs: baseDurationMs ?? 0 },
      edit: edit?.baseGeneration === base ? toEditView(edit) : null,
      items: generations.map((row) => ({
        generation: row.generation,
        kind: row.kind,
        status: row.status,
        durationMs: row.playback?.durationMs ?? null,
        needsReview: row.needsReview,
        errorCode: row.errorCode,
        purgeAfter: row.purgeAfter ? isoOf(row.purgeAfter) : null,
        createdAt: isoOf(row.createdAt),
      })),
    });
  }

  async save(
    user: UserContext,
    videoId: string,
    list: VideoEditList
  ): Promise<Result<VideoEditView, SaveEditFailure>> {
    const found = await this.context(user, videoId);
    if (isErr(found)) return found;
    const { video, generations, base, baseDurationMs } = found.value;
    const decided =
      baseDurationMs === null
        ? err(invalidVideoEdit('trim', `The base generation ${base} has no duration`))
        : decideVideoEdit(list, { durationMs: baseDurationMs });
    if (isErr(decided)) return decided;
    const startable = decideGenerationStart(video, generations);
    if (isErr(startable)) return startable;

    const generation = nextGeneration(video.generation, generations);
    const saved = await this.deps.generations.saveEdit({
      videoId,
      generation,
      baseGeneration: base,
      replacesGeneration: video.generation,
      edit: decided.value,
      outbox: applyEditsOutbox({ videoId, generation, traceparent: this.deps.traceparent() }),
    });
    if (isErr(saved)) return saved;
    if (!saved.value) return err(generationInProgress(videoId));
    return ok(
      toEditView({
        ...decided.value,
        videoId,
        baseGeneration: base,
        generation,
        status: 'rendering',
        updatedAt: new Date(this.deps.now()),
      })
    );
  }

  /** Swaps the base back in under `version`; a stale version is a conflict, as for any edit. */
  async revert(
    user: UserContext,
    videoId: string,
    version: number
  ): Promise<Result<{ generation: number; version: number }, RevertEditFailure>> {
    const found = await this.context(user, videoId);
    if (isErr(found)) return found;
    const revertible = decideEditRevert(found.value.video, found.value.edit);
    if (isErr(revertible)) return revertible;

    const { baseGeneration } = revertible.value;
    const swapped = await this.deps.generations.swap({
      videoId,
      generation: baseGeneration,
      claim: { type: 'revert', expectedVersion: version },
      now: new Date(this.deps.now()),
    });
    if (isErr(swapped)) return swapped;
    switch (swapped.value.type) {
      case 'swapped':
        return ok({ generation: baseGeneration, version: swapped.value.version });
      case 'superseded':
        return err(versionConflict(videoId, version));
      case 'fenced':
        return err(noEditToRevert(videoId));
    }
  }
}
