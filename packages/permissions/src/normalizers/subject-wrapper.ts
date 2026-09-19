import { subject } from '@casl/ability';
import type { ChannelResource, CommentResource, UploadResource, VideoResource } from '../types';
import { normalizeChannelResource } from './channel.normalizer.js';
import { normalizeCommentResource } from './comment.normalizer.js';
import { normalizeUploadResource } from './upload.normalizer.js';
import { normalizeVideoResource } from './video.normalizer.js';

/**
 * Creates a CASL subject wrapper using a resource normalizer.
 * Returns undefined if the normalizer yields undefined.
 */
export function createSubject<TName extends string, TInput, TNormalized extends object>(
  subjectName: TName,
  input: TInput,
  normalizer: (res: TInput) => TNormalized | undefined
) {
  const normalized = normalizer(input);
  return normalized !== undefined ? subject(subjectName, normalized) : undefined;
}

export function toVideoSubject(video?: Partial<VideoResource> | null) {
  const normalized = normalizeVideoResource(video);
  return normalized !== undefined ? subject('Video', normalized) : undefined;
}

export function toChannelSubject(channel?: Partial<ChannelResource> | null) {
  const normalized = normalizeChannelResource(channel);
  return normalized !== undefined ? subject('Channel', normalized) : undefined;
}

export function toCommentSubject(comment?: Partial<CommentResource> | null, videoOwnerId?: string) {
  const normalized = normalizeCommentResource(comment, videoOwnerId);
  return normalized !== undefined ? subject('Comment', normalized) : undefined;
}

export function toUploadSubject(
  upload?: Partial<UploadResource> | null,
  video?: Partial<VideoResource> | null
) {
  const normalized = normalizeUploadResource(upload, video);
  return normalized !== undefined ? subject('Upload', normalized) : undefined;
}
