import { ErrorCodes, type Failure } from '@vp/errors';
import { type InvalidField, invalidField } from '@vp/validation';

export { type PickWindowOverlap, pickWindowOverlap } from '@vp/errors';

export type PickNotFound = Failure<typeof ErrorCodes.PICK_NOT_FOUND, { pickId: string }>;

export type InvalidPickWindow = InvalidField<Record<never, never>>;

export type InvalidPickVideo = InvalidField<{ readonly videoId: string }>;

export function pickNotFound(pickId: string): PickNotFound {
  return { code: ErrorCodes.PICK_NOT_FOUND, message: 'Pick not found', pickId };
}

export function invalidPickWindow(
  field: 'startsAt' | 'endsAt',
  message: string
): InvalidPickWindow {
  return invalidField(field, message, {});
}

export function invalidPickVideo(videoId: string): InvalidPickVideo {
  return invalidField('videoId', 'Only a public, ready video can be picked', { videoId });
}
