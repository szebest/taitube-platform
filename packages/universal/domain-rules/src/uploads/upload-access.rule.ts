import { type UserContext, canAccessUpload } from '@vp/permissions';
import { type Result, err, map } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type UploadNotFound, uploadNotFound } from './failures';

/** What the rule needs to answer: who owns the video the upload writes into. */
export interface OwnedUpload {
  readonly id: string;
  readonly ownerId: string;
}

export interface UploadAccessInput<T extends OwnedUpload> {
  readonly actor: UserContext | null;
  readonly upload: T | null;
  readonly uploadId: string;
  /** Read back in the refusal, so the caller learns which use case refused. */
  readonly action: string;
}

export type UploadAccessFailure = UploadNotFound | AuthorizationFailure;

/**
 * Absence first, then ownership. An upload id is a v7 UUID minted by the server, so an unknown one
 * carries nothing to leak; a *known* one owned by someone else is what has to refuse.
 */
export function decideUploadAccess<T extends OwnedUpload>(
  input: UploadAccessInput<T>
): Result<T, UploadAccessFailure> {
  const { actor, upload, uploadId, action } = input;
  if (!upload) return err(uploadNotFound(uploadId));

  const allowed = canAccessUpload({
    user: actor,
    upload: { ownerId: upload.ownerId },
    video: { ownerId: upload.ownerId },
  });

  return map(
    authorize(actor, allowed, {
      action: 'access',
      subject: 'Upload',
      message: `Not authorized to ${action}`,
    }),
    () => upload
  );
}
