import { type Result, andThen, err, map, ok } from '@vp/result';
import { validateContentType } from './allowed-content-type';
import { type StartUploadFailure, invalidTitle } from './failures';
import { validateUploadSize } from './upload-size';

const MAX_TITLE_LENGTH = 200;

export interface UploadLimits {
  readonly maxBytes: number;
  readonly allowedContentTypes: readonly string[];
  readonly maxTitleLength?: number;
}

export interface StartUploadInput {
  readonly filename: string;
  readonly sizeBytes: number;
  readonly contentType: string;
  readonly title?: string | null;
}

function validateTitle(
  title: string | null | undefined,
  maxLength: number
): Result<string | null | undefined, StartUploadFailure> {
  if (title === undefined || title === null) return ok(title);
  return title.length === 0 || title.length > maxLength ? err(invalidTitle(maxLength)) : ok(title);
}

export function validateStartUpload(
  input: StartUploadInput,
  limits: UploadLimits
): Result<StartUploadInput, StartUploadFailure> {
  const maxTitleLength = limits.maxTitleLength ?? MAX_TITLE_LENGTH;

  return andThen(validateUploadSize(input.sizeBytes, limits.maxBytes), () =>
    andThen(validateContentType(input.contentType, limits.allowedContentTypes), () =>
      map(validateTitle(input.title, maxTitleLength), () => input)
    )
  );
}
