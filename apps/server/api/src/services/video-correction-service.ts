import { type Result, andThenAsync, err, isErr, ok } from '@kit/result';
import type { VideoCorrectionRepository, VideoRepository } from '@vp/core/repositories';
import { type Correction, MAX_CORRECTIONS_PER_VIDEO } from '@vp/domain';
import {
  type CorrectionLimit,
  type CorrectionNotFound,
  type InvalidCorrection,
  type ReadVideoFailure,
  correctionLimit,
  correctionNotFound,
  decideCorrection,
  decideCorrectionFields,
  decideVideoEditAccess,
  decideVideoRead,
  publicReadFailure,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { uuidv7 } from 'uuidv7';
import { isoOf } from './cursor';

export interface VideoCorrectionServiceDeps {
  videos: VideoRepository;
  corrections: VideoCorrectionRepository;
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

type ReadFailure = ReadVideoFailure | DatabaseUnavailable;

export type CreateCorrectionFailure = ReadFailure | InvalidCorrection | CorrectionLimit;
export type UpdateCorrectionFailure = ReadFailure | InvalidCorrection | CorrectionNotFound;
export type RemoveCorrectionFailure = ReadFailure | CorrectionNotFound;

function toCorrectionView(correction: Correction): CorrectionView {
  return { ...correction, createdAt: isoOf(correction.createdAt) };
}

export class VideoCorrectionService {
  constructor(private readonly deps: VideoCorrectionServiceDeps) {}

  async list(
    viewer: UserContext | null,
    videoId: string
  ): Promise<Result<{ items: CorrectionView[] }, ReadFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    const readable = decideVideoRead({ viewer, video: found.value, videoId });
    if (isErr(readable)) return err(publicReadFailure(readable.error));

    const rows = await this.deps.corrections.list(videoId);
    return andThenAsync(rows, async (items) => ok({ items: items.map(toCorrectionView) }));
  }

  async create(
    user: UserContext,
    videoId: string,
    body: { startMs: number; endMs: number; text: string }
  ): Promise<Result<CorrectionView, CreateCorrectionFailure>> {
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    const video = decideVideoEditAccess({ editor: user, video: found.value, videoId });
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
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    const video = decideVideoEditAccess({ editor: user, video: found.value, videoId });
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
    const found = await this.deps.videos.findById(videoId);
    if (isErr(found)) return found;
    const video = decideVideoEditAccess({ editor: user, video: found.value, videoId });
    if (isErr(video)) return video;

    const removed = await this.deps.corrections.remove(videoId, correctionId);
    if (isErr(removed)) return removed;
    return removed.value ? ok(null) : err(correctionNotFound(correctionId));
  }
}
