import { type Failure } from '@kit/errors';
import { VIDEO_PASSWORD_MAX_LENGTH, VIDEO_PASSWORD_MIN_LENGTH } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { type InvalidField, invalidField } from '@vp/validation';

export type VideoPasswordRequired = Failure<
  typeof ErrorCodes.VIDEO_PASSWORD_REQUIRED,
  { videoId: string }
>;
export type VideoPasswordInvalid = Failure<
  typeof ErrorCodes.VIDEO_PASSWORD_INVALID,
  { videoId: string }
>;
export type VideoPasswordsOff = Failure<typeof ErrorCodes.VIDEO_PASSWORDS_OFF>;
export type InvalidVideoPassword = InvalidField<{
  readonly minLength: number;
  readonly maxLength: number;
}>;

export function videoPasswordRequired(videoId: string): VideoPasswordRequired {
  return {
    code: ErrorCodes.VIDEO_PASSWORD_REQUIRED,
    message: 'This video needs its password',
    videoId,
  };
}

export function videoPasswordInvalid(videoId: string): VideoPasswordInvalid {
  return { code: ErrorCodes.VIDEO_PASSWORD_INVALID, message: 'The password is wrong', videoId };
}

export function videoPasswordsOff(): VideoPasswordsOff {
  return {
    code: ErrorCodes.VIDEO_PASSWORDS_OFF,
    message: 'Video passwords need VIDEO_ACCESS_SECRET, which this server does not have',
  };
}

export function invalidVideoPassword(
  field: 'password' | 'visibility',
  reason: string
): InvalidVideoPassword {
  return invalidField(field, reason, {
    minLength: VIDEO_PASSWORD_MIN_LENGTH,
    maxLength: VIDEO_PASSWORD_MAX_LENGTH,
  });
}
