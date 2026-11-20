import { type Result, andThenAsync, err, isErr, ok } from '@kit/result';
import type { VideoCorrectionRepository, VideoRepository } from '@vp/core/repositories';
import { type Correction, MAX_CORRECTIONS_PER_VIDEO } from '@vp/domain';
import {
  type CorrectionLimit,
  type CorrectionNotFound,
  type InvalidCorrection,
  correctionLimit,
  correctionNotFound,
  decideCorrection,
  decideCorrectionFields,
} from '@vp/domain-rules';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { isoOf } from './cursor';
import type { GatedReadFailure, VideoAccess, VideoAccessGate } from './video-access-gate';
import { type EditAccessFailure, editableVideo } from './video-edit-access';

export interface VideoCorrectionServiceDeps {
  videos: VideoRepository;
  corrections: VideoCorrectionRepository;
  gate: VideoAccessGate;
  now: () => number;
}

export interface CorrectionView {
  id: string;
  videoId: string;
  startMs: number;
  endMs: number;
  text: string;
  createdAt: string;
}

export type CreateCorrectionFailure = EditAccessFailure | InvalidCorrection | CorrectionLimit;
export type UpdateCorrectionFailure = EditAccessFailure | InvalidCorrection | CorrectionNotFound;
export type RemoveCorrectionFailure = EditAccessFailure | CorrectionNotFound;

function toCorrectionView(correction: Correction): CorrectionView {
  return { ...correction, createdAt: isoOf(correction.createdAt) };
}

export class VideoCorrectionService {
  constructor(private readonly deps: VideoCorrectionServiceDeps) {}

  /** The watch page's own gate: what keeps the video from a viewer keeps its corrections too. */
  async list(
    viewer: UserContext | null,
    videoId: string,
    access: VideoAccess
  ): Promise<Result<{ items: CorrectionView[] }, GatedReadFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    const readable = await this.deps.gate.read(viewer, found.value, videoId, access);
    if (isErr(readable)) return readable;

    const rows = await this.deps.corrections.list(videoId);
    return andThenAsync(rows, async (items) => ok({ items: items.map(toCorrectionView) }));
  }

  async create(
    user: UserContext,
    videoId: string,
    body: { startMs: number; endMs: number; text: string }
  ): Promise<Result<CorrectionView, CreateCorrectionFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;

    const existing = await this.deps.corrections.list(videoId);
    if (isErr(existing)) return existing;
    const decided = decideCorrection(body, {
      videoId,
      durationMs: video.value.durationMs,
      existing: existing.value.length,
    });
    if (isErr(decided)) return decided;

    const correction: Correction = {
      ...decided.value,
      id: uuidv7(),
      videoId,
      createdAt: new Date(this.deps.now()),
    };
    const created = await this.deps.corrections.create(correction, MAX_CORRECTIONS_PER_VIDEO);
    if (isErr(created)) return created;
    return created.value ? ok(toCorrectionView(correction)) : err(correctionLimit(videoId));
  }

  async update(
    user: UserContext,
    videoId: string,
    correctionId: string,
    changes: Partial<{ startMs: number; endMs: number; text: string }>
  ): Promise<Result<CorrectionView, UpdateCorrectionFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;

    const existing = await this.deps.corrections.list(videoId);
    if (isErr(existing)) return existing;
    const current = existing.value.find(({ id }) => id === correctionId);
    if (!current) return err(correctionNotFound(correctionId));

    const decided = decideCorrectionFields(
      { startMs: current.startMs, endMs: current.endMs, text: current.text, ...changes },
      { durationMs: video.value.durationMs }
    );
    if (isErr(decided)) return decided;

    const updated = await this.deps.corrections.update(videoId, correctionId, decided.value);
    if (isErr(updated)) return updated;
    return updated.value
      ? ok(toCorrectionView(updated.value))
      : err(correctionNotFound(correctionId));
  }

  async remove(
    user: UserContext,
    videoId: string,
    correctionId: string
  ): Promise<Result<null, RemoveCorrectionFailure>> {
    const video = await editableVideo(this.deps.videos, user, videoId);
    if (isErr(video)) return video;

    const removed = await this.deps.corrections.remove(videoId, correctionId);
    if (isErr(removed)) return removed;
    return removed.value ? ok(null) : err(correctionNotFound(correctionId));
  }
}
