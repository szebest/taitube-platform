import type { Upload } from '@vp/domain';
import { type Result, err, ok } from '@vp/result';
import { type PartManifestMismatch, partManifestMismatch } from './failures';

export interface UploadPart {
  readonly partNumber: number;
  readonly etag: string;
}

export interface PartManifestInput {
  readonly upload: Upload;
  readonly parts?: readonly UploadPart[];
}

export function decidePartManifest(
  input: PartManifestInput
): Result<readonly UploadPart[], PartManifestMismatch> {
  const { upload, parts } = input;
  const received = parts?.length ?? 0;

  if (received === 0 || upload.partsExpected === null || received !== upload.partsExpected) {
    return err(partManifestMismatch(upload.id, upload.partsExpected, received));
  }
  return ok(parts as readonly UploadPart[]);
}
