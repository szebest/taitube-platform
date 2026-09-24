import { subject } from '@casl/ability';
import type { UploadResource, VideoResource } from '../types/index';
import { normalizeUploadResource } from './upload.normalizer';
import { normalizeVideoResource } from './video.normalizer';

function createSubject<TName extends string, TNormalized extends object>(
  subjectName: TName,
  normalized: TNormalized | undefined
) {
  return normalized !== undefined ? subject(subjectName, normalized) : undefined;
}

export function toVideoSubject(video?: Partial<VideoResource> | null) {
  return createSubject('Video', normalizeVideoResource(video));
}

export function toUploadSubject(
  upload?: Partial<UploadResource> | null,
  video?: Partial<VideoResource> | null
) {
  return createSubject('Upload', normalizeUploadResource(upload, video));
}
