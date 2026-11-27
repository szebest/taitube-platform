import { type Result, err, ok } from '@kit/result';
import type { Video, VideoEdit, VideoGeneration, VideoStatus } from '@vp/domain';
import { type VideoStatusNotEligible, videoStatusNotEligible } from '../videos/failures';
import {
  type GenerationInProgress,
  type NoEditToRevert,
  generationInProgress,
  noEditToRevert,
} from './failures';
import { VIDEO_GENERATION } from './video-generation.machine';

/** Only a video that plays can be replaced or edited, and only while it still does can a render swap in. */
export const RENDERABLE_STATUSES: readonly VideoStatus[] = ['READY'];

/** The generations still uploading or rendering: a video has at most one. */
export const IN_FLIGHT_GENERATIONS = VIDEO_GENERATION.sources('fail');

export type GenerationStartFailure = VideoStatusNotEligible | GenerationInProgress;

/** A replacement or an edit starts on a `READY` video with nothing else in flight. */
export function decideGenerationStart(
  video: Video,
  generations: readonly VideoGeneration[]
): Result<Video, GenerationStartFailure> {
  if (!RENDERABLE_STATUSES.includes(video.status)) {
    return err(videoStatusNotEligible(video.id, video.status, RENDERABLE_STATUSES));
  }
  return generations.some(({ status }) => IN_FLIGHT_GENERATIONS.includes(status))
    ? err(generationInProgress(video.id))
    : ok(video);
}

/**
 * Reverting swaps back to the base of the edit that plays, read off its own generation: a later edit
 * that failed or is still saved over the edit list never hides it. Nothing reverts while a render is in
 * flight.
 */
export function decideEditRevert(
  video: Video,
  generations: readonly VideoGeneration[]
): Result<{ baseGeneration: number }, NoEditToRevert> {
  const playing = generations.find(({ generation }) => generation === video.generation);
  const inFlight = generations.some(({ status }) => IN_FLIGHT_GENERATIONS.includes(status));
  return playing?.kind === 'edit' &&
    playing.baseGeneration !== null &&
    playing.baseGeneration !== playing.generation &&
    !inFlight
    ? ok({ baseGeneration: playing.baseGeneration })
    : err(noEditToRevert(video.id));
}

/**
 * The generation a new edit renders from: the edit list's base while the video still plays it or an
 * edit of it, otherwise what plays now, because a replacement or a purged base starts a new lineage.
 */
export function decideEditBase(
  video: Video,
  edit: VideoEdit | null,
  generations: readonly VideoGeneration[]
): number {
  if (!edit || video.generation === edit.baseGeneration)
    return edit?.baseGeneration ?? video.generation;
  const playing = generations.find(({ generation }) => generation === video.generation);
  return playing?.kind === 'edit' && playing.baseGeneration === edit.baseGeneration
    ? edit.baseGeneration
    : video.generation;
}
