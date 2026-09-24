import { subject } from '@casl/ability';
import type {
  ChannelResource,
  CommentResource,
  UploadResource,
  VideoResource,
} from '../types/index';
import { normalizeChannelResource } from './channel.normalizer';
import { normalizeCommentResource } from './comment.normalizer';
import { normalizeUploadResource } from './upload.normalizer';
import { normalizeVideoResource } from './video.normalizer';

export function createSubject<TName extends string, TNormalized extends object>(
  subjectName: TName,
  normalized: TNormalized | undefined
) {
  return normalized !== undefined ? subject(subjectName, normalized) : undefined;
}

export function toVideoSubject(video?: Partial<VideoResource> | null) {
  return createSubject('Video', normalizeVideoResource(video));
}

export function toChannelSubject(channel?: Partial<ChannelResource> | null) {
  return createSubject('Channel', normalizeChannelResource(channel));
}

export function toCommentSubject(comment?: Partial<CommentResource> | null, videoOwnerId?: string) {
  return createSubject('Comment', normalizeCommentResource(comment, videoOwnerId));
}

export function toUploadSubject(
  upload?: Partial<UploadResource> | null,
  video?: Partial<VideoResource> | null
) {
  return createSubject('Upload', normalizeUploadResource(upload, video));
}
