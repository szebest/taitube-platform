import { andThen, err, map, ok, type Result } from '@vp/result';
import { VIDEO_TITLE_BOUNDS } from '../videos/metadata';
import { validateContentType } from './allowed-content-type';
import { invalidTitle, type StartUploadFailure } from './failures';
import { validateUploadSize } from './upload-size';

export interface UploadLimits {
  readonly maxBytes: number;
  readonly allowedContentTypes: readonly string[];
}

export interface StartUploadInput {
  readonly filename: string;
  readonly sizeBytes: number;
  readonly contentType: string;
  readonly title?: string | null;
}

function validateTitle(
  title: string | null | undefined
): Result<string | null | undefined, StartUploadFailure> {
  if (title === undefined || title === null) return ok(title);
  const { maxLength } = VIDEO_TITLE_BOUNDS;
  return title.length === 0 || title.length > maxLength ? err(invalidTitle(maxLength)) : ok(title);
}

export function validateStartUpload(
  input: StartUploadInput,
  limits: UploadLimits
): Result<StartUploadInput, StartUploadFailure> {
  return andThen(validateUploadSize(input.sizeBytes, limits.maxBytes), () =>
    andThen(validateContentType(input.contentType, limits.allowedContentTypes), () =>
      map(validateTitle(input.title), () => input)
    )
  );
}
